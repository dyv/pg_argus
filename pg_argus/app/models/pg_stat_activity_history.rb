class PgStatActivityHistory < ClickhouseRecord
  self.table_name = "pg_stat_activity_history"
  # bulk_load loads data from postgres: pg_stat_activity, pg_locks, pg_class
  # and inserts it into Clickhouse in one insert_all statement.
  def self.bulk_load!(timestamp, pgconn)
    pg_stat_activity_cols = PG_STAT_ACTIVITY_COLUMNS.map { |k, v| "pg_stat_activity.#{k} AS #{v}" }.join(",")
    pg_locks_cols = PG_LOCKS_COLUMNS.map { |k, v| "pg_locks.#{k} AS #{v}" }.join(",")
    pg_locks_class_cols = PG_LOCKS_CLASS_COLUMNS.map { |k, v| "#{k} AS #{v}" }.join(",")
    pg_stat_progress_analyze_cols = PG_STAT_PROGRESS_ANALYZE_COLUMNS.map { |k, v| "pg_stat_progress_analyze.#{k} AS #{v}" }.join(",")
    pg_analyze_class_cols = PG_ANALYZE_CLASS_COLUMNS.map { |k, v| "#{k} AS #{v}" }.join(",")
    pg_stat_progress_cluster_cols = PG_STAT_PROGRESS_CLUSTER_COLUMNS.map { |k, v| "pg_stat_progress_cluster.#{k} AS #{v}" }.join(",")
    pg_cluster_class_cols = PG_CLUSTER_CLASS_COLUMNS.map { |k, v| "#{k} AS #{v}" }.join(",")
    pg_stat_progress_copy_cols = PG_STAT_PROGRESS_COPY_COLUMNS.map { |k, v| "pg_stat_progress_copy.#{k} AS #{v}" }.join(",")
    pg_copy_class_cols = PG_COPY_CLASS_COLUMNS.map { |k, v| "#{k} AS #{v}" }.join(",")
    pg_stat_progress_create_index_cols = PG_STAT_PROGRESS_CREATE_INDEX_COLUMNS.map { |k, v| "pg_stat_progress_create_index.#{k} AS #{v}" }.join(",")
    pg_create_index_class_cols = PG_CREATE_INDEX_CLASS_COLUMNS.map { |k, v| "#{k} AS #{v}" }.join(",")
    pg_stat_progress_vacuum_cols = PG_STAT_PROGRESS_VACUUM_COLUMNS.map { |k, v| "pg_stat_progress_vacuum.#{k} AS #{v}" }.join(",")
    pg_vacuum_class_cols = PG_VACUUM_CLASS_COLUMNS.map { |k, v| "#{k} AS #{v}" }.join(",")
    pg_stat_progress_basebackup_cols = PG_STAT_PROGRESS_BASEBACKUP_COLUMNS.map { |k, v| "pg_stat_progress_basebackup.#{k} AS #{v}" }.join(",")
    pg_stat_replication_cols = PG_STAT_REPLICATION_COLUMNS.map { |k, v| "pg_stat_replication.#{k} AS #{v}" }.join(",")
    pg_stat_wal_receiver_cols = PG_STAT_WAL_RECEIVER_COLUMNS.map { |k, v| "pg_stat_wal_receiver.#{k} AS #{v}" }.join(",")

    start = Time.current
    results = pgconn.exec(<<-SQL
      SELECT * FROM
        (SELECT
          #{pg_stat_activity_cols},
          #{pg_locks_cols},
          #{pg_locks_class_cols},
          #{pg_stat_progress_analyze_cols},
          #{pg_analyze_class_cols},
          #{pg_stat_progress_cluster_cols},
          #{pg_cluster_class_cols},
          #{pg_stat_progress_copy_cols},
          #{pg_copy_class_cols},
          #{pg_stat_progress_create_index_cols},
          #{pg_create_index_class_cols},
          #{pg_stat_progress_vacuum_cols},
          #{pg_vacuum_class_cols},
          #{pg_stat_progress_basebackup_cols},
          #{pg_stat_replication_cols},
          #{pg_stat_wal_receiver_cols}
         FROM pg_catalog.pg_stat_activity
          LEFT JOIN pg_locks ON pg_stat_activity.pid = pg_locks.pid
            LEFT JOIN pg_catalog.pg_class as pg_locks_class ON pg_locks.relation = pg_locks_class.oid
          LEFT JOIN pg_stat_progress_analyze ON pg_stat_activity.pid = pg_stat_progress_analyze.pid
            LEFT JOIN pg_catalog.pg_class as pg_analyze_class ON pg_stat_progress_analyze.relid = pg_analyze_class.oid
          LEFT JOIN pg_stat_progress_cluster ON pg_stat_activity.pid = pg_stat_progress_cluster.pid
            LEFT JOIN pg_catalog.pg_class as pg_cluster_class ON pg_stat_progress_cluster.relid = pg_cluster_class.oid
            LEFT JOIN pg_catalog.pg_class as pg_cluster_index_class ON pg_stat_progress_cluster.cluster_index_relid = pg_cluster_index_class.oid
          LEFT JOIN pg_stat_progress_copy ON pg_stat_activity.pid = pg_stat_progress_copy.pid
            LEFT JOIN pg_catalog.pg_class as pg_copy_class ON pg_stat_progress_copy.relid = pg_copy_class.oid
          LEFT JOIN pg_stat_progress_create_index ON pg_stat_activity.pid = pg_stat_progress_create_index.pid
            LEFT JOIN pg_catalog.pg_class as pg_create_index_class ON pg_stat_progress_create_index.relid = pg_create_index_class.oid
            LEFT JOIN pg_catalog.pg_class as pg_create_index_index_class ON pg_stat_progress_create_index.index_relid = pg_create_index_index_class.oid
          LEFT JOIN pg_stat_progress_vacuum ON pg_stat_activity.pid = pg_stat_progress_vacuum.pid
            LEFT JOIN pg_catalog.pg_class as pg_vacuum_class ON pg_stat_progress_vacuum.relid = pg_vacuum_class.oid
          LEFT JOIN pg_stat_progress_basebackup ON pg_stat_activity.pid = pg_stat_progress_basebackup.pid
          LEFT JOIN pg_stat_replication ON pg_stat_activity.pid = pg_stat_replication.pid
          LEFT JOIN pg_stat_wal_receiver ON pg_stat_activity.pid = pg_stat_wal_receiver.pid
        )
      WHERE state != 'idle' AND pid != pg_backend_pid()
      SQL
    )
    start = Time.current
    data = []
    results.each do |row|
      # turn each row into a hash to insert
      row["timestamp"] = timestamp
      row["query"] = row["query"].strip
      generate_derived_data(row)

      data << row
    end

    start = Time.current
    # insert all the data into Clickhouse
    begin
      # log the number of rows to insert
      logger.info("Inserting #{data.length}")

      insert_all!(data)
    rescue Exception => e
      puts e.class
      puts e.message
      e.backtrace.each do |line|
        puts line
      end
    end
  end

  def self.generate_derived_data(row)
    query = row["query"]
    parsed = true
    begin
      sql = Sql.new(query)
    rescue StandardError => e
      # This is a hack because sometimes a list is so large, it can't be stored
      # in pg_stat_statements.
      query = query + ")"
      begin
        sql = Sql.new(query)
      rescue StandardError => e
        parsed = false
        logger.error("Error parsing query: #{e.message}: #{query}")
      end
    end
    if parsed
      row["normalized_query"] = sql.normalized
      row["simplified_query"] = sql.simplified
      row["tables"] = sql.tables
      row["filter_columns"] = sql.filter_columns
      row["fingerprint"] = sql.fingerprint
    else
      row["simplified_query"] = "query_too_large_to_parse"
      row["normalized_query"] = "query_too_large_to_parse"
      row["tables"] = []
      row["filter_columns"] = []
      row["fingerprint"] = "query_too_large_to_parse"
    end
  end

  DERIVED_COLUMNS = {
    "simplified_query": "simplified_query",
    "normalized_query": "normalized_query",
    "tables": "tables", # comma separated list of tables
    "filter_columns": "filter_columns", # comma separated list of columns
    "fingerprint": "fingerprint",
  }
  PG_STAT_ACTIVITY_COLUMNS = {
    "datname": "datname",
    "pid": "pid",
    "leader_pid": "leader_pid",
    "usename": "usename",
    "application_name": "application_name",
    "client_addr": "client_addr",
    "client_hostname": "client_hostname",
    "client_port": "client_port",
    "backend_start": "backend_start",
    "xact_start": "xact_start",
    "query_start": "query_start",
    "state_change": "state_change",
    "wait_event_type": "wait_event_type",
    "wait_event": "wait_event",
    "state": "state",
    "backend_xid": "backend_xid",
    "backend_xmin": "backend_xmin",
    "query_id": "query_id",
    "query": "query",
    "backend_type": "backend_type",
  }
  PG_LOCKS_COLUMNS = {
    "locktype": "locktype",
    "page": "page",
    "tuple": "tuple",
    "virtualxid": "virtualxid",
    "transactionid": "transactionid",
    "classid": "classid",
    "objid": "objid",
    "objsubid": "objsubid",
    "virtualtransaction": "virtualtransaction",
    "mode": "mode",
    "granted": "granted",
    "fastpath": "fastpath",
    "waitstart": "waitstart",
  }
  PG_LOCKS_CLASS_COLUMNS = {
    "pg_locks_class.relname": "lock_relname",
  }
  PG_STAT_PROGRESS_ANALYZE_COLUMNS = {
    "phase": "analyze_phase",
    "sample_blks_total": "sample_blks_total",
    "sample_blks_scanned": "sample_blks_scanned",
    "ext_stats_total": "ext_stats_total",
    "ext_stats_computed": "ext_stats_computed",
    "child_tables_total": "child_tables_total",
    "child_tables_done": "child_tables_done",
  }
  PG_ANALYZE_CLASS_COLUMNS = {
    "pg_analyze_class.relname": "analyze_relname",
  }
  PG_STAT_PROGRESS_CLUSTER_COLUMNS = {
    "command": "cluster_command",
    "phase": "cluster_phase",
    "heap_tuples_scanned": "heap_tuples_scanned",
    "heap_tuples_written": "heap_tuples_written",
    "heap_blks_total": "cluster_heap_blks_total",
    "heap_blks_scanned": "cluster_heap_blks_scanned",
    "index_rebuild_count": "index_rebuild_count",
  }
  PG_CLUSTER_CLASS_COLUMNS = {
    "pg_cluster_class.relname": "cluster_relname",
    "pg_cluster_index_class.relname": "cluster_index_relname",
  }
  PG_STAT_PROGRESS_COPY_COLUMNS = {
    "command": "copy_command",
    "type": "type",
    "bytes_processed": "bytes_processed",
    "bytes_total": "bytes_total",
    "tuples_processed": "tuples_processed",
    "tuples_excluded": "tuples_excluded",
  }
  PG_COPY_CLASS_COLUMNS = {
    "pg_copy_class.relname": "copy_relname",
  }
  PG_STAT_PROGRESS_CREATE_INDEX_COLUMNS = {
    "command": "create_index_command",
    "phase": "create_index_phase",
    "lockers_total": "lockers_total",
    "lockers_done": "lockers_done",
    "blocks_total": "blocks_total",
    "blocks_done": "blocks_done",
    "tuples_total": "tuples_total",
    "tuples_done": "tuples_done",
    "partitions_total": "partitions_total",
    "partitions_done": "partitions_done",
  }
  PG_CREATE_INDEX_CLASS_COLUMNS = {
    "pg_create_index_class.relname": "create_index_relname",
    "pg_create_index_index_class.relname": "create_index_index_relname",
  }
  PG_STAT_PROGRESS_VACUUM_COLUMNS = {
    "phase": "vacuum_phase",
    "heap_blks_total": "heap_blks_total",
    "heap_blks_scanned": "heap_blks_scanned",
    "heap_blks_vacuumed": "heap_blks_vacuumed",
    "index_vacuum_count": "index_vacuum_count",
    "max_dead_tuples": "max_dead_tuples",
    "num_dead_tuples": "num_dead_tuples",
  }
  PG_VACUUM_CLASS_COLUMNS = {
    "pg_vacuum_class.relname": "vacuum_relname",
  }
  PG_STAT_PROGRESS_BASEBACKUP_COLUMNS = {
    "phase": "basebackup_phase",
    "backup_total": "backup_total",
    "backup_streamed": "backup_streamed",
    "tablespaces_total": "tablespaces_total",
    "tablespaces_streamed": "tablespaces_streamed",
  }
  PG_STAT_REPLICATION_COLUMNS = {
    "state": "replication_state",
    "sent_lsn": "sent_lsn",
    "write_lsn": "write_lsn",
    "flush_lsn": "flush_lsn",
    "replay_lsn": "replay_lsn",
    "write_lag": "write_lag",
    "flush_lag": "flush_lag",
    "replay_lag": "replay_lag",
    "sync_priority": "sync_priority",
    "sync_state": "sync_state",
    "reply_time": "reply_time",
  }
  PG_STAT_WAL_RECEIVER_COLUMNS = {
    "status": "status",
    "receive_start_lsn": "receive_start_lsn",
    "receive_start_tli": "receive_start_tli",
    "written_lsn": "written_lsn",
    "flushed_lsn": "flushed_lsn",
    "received_tli": "received_tli",
    "last_msg_send_time": "last_msg_send_time",
    "last_msg_receipt_time": "last_msg_receipt_time",
    "latest_end_lsn": "latest_end_lsn",
    "latest_end_time": "latest_end_time",
    "slot_name": "slot_name",
    "sender_host": "sender_host",
    "sender_port": "sender_port",
    "conninfo": "conninfo",
  }
end
