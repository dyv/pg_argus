class CreatePgStatActivityHistory < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!

  def change
    create_table "pg_stat_activity_history", id: false, options: 'MergeTree PARTITION BY toYYYYMM(timestamp) ORDER BY (timestamp)'  do |t|
      # timestamp
      t.datetime :timestamp, precision: 3, null: false
      # pg_stat_activity
      t.string :datname, null: false
      t.integer :pid, null: false
      t.integer :leader_pid, null: true
      t.string :usename, null: false
      t.string :application_name, null: true
      t.string :client_addr, null: true
      t.string :client_hostname, null: true
      t.integer :client_port, null: true
      t.datetime :backend_start, precision: 3, null: true
      t.datetime :xact_start, precision: 3, null: true
      t.datetime :query_start, precision: 3, null: true
      t.datetime :state_change, precision: 3, null: true
      t.string :wait_event_type, null: true
      t.string :wait_event, null: true
      t.string :state, null: true
      t.integer :backend_xid, null: true
      t.integer :backend_xmin, null: true
      t.integer :query_id, null: true, unsigned: false, limit: 8
      t.string :query, null: true
      t.string :backend_type, null: true

      # pg_locks
      t.string :locktype, null: true
      t.integer :page, null: true
      t.integer :tuple, null: true
      t.string :virtualxid, null: true
      t.integer :transactionid, null: true
      t.integer :classid, null: true
      t.integer :objid, null: true
      t.integer :objsubid, null: true
      t.string :virtualtransaction, null: true
      t.string :mode, null: true
      t.boolean :granted, null: true
      t.boolean :fastpath, null: true
      t.datetime :waitstart, precision: 3, null: true

      # pg_class
      t.string :lock_relname, null: true

      # pg_stat_progress_analyze
      t.string :analyze_phase, null: true
      t.integer :sample_blks_total, null: true, unsigned: false, limit: 8
      t.integer :sample_blks_scanned, null: true, unsigned: false, limit: 8
      t.integer :ext_stats_total, null: true, unsigned: false, limit: 8
      t.integer :ext_stats_computed, null: true, unsigned: false, limit: 8
      t.integer :child_tables_total, null: true, unsigned: false, limit: 8
      t.integer :child_tables_done, null: true, unsigned: false, limit: 8

      # pg_class
      t.string :analyze_relname, null: true

      # pg_stat_progress_cluster
      t.string :cluster_command, null: true
      t.string :cluster_phase, null: true
      t.integer :heap_tuples_scanned, null: true, unsigned: false, limit: 8
      t.integer :heap_tuples_written, null: true, unsigned: false, limit: 8
      t.integer :cluster_heap_blks_total, null: true, unsigned: false, limit: 8
      t.integer :cluster_heap_blks_scanned, null: true, unsigned: false, limit: 8
      t.integer :index_rebuild_count, null: true, unsigned: false, limit: 8

      # pg_class
      t.string :cluster_relname, null: true
      t.string :cluster_index_relname, null: true

      # pg_stat_progress_copy
      t.string :copy_command, null: true
      t.string :type, null: true
      t.integer :bytes_processed, null: true, unsigned: false, limit: 8
      t.integer :bytes_total, null: true, unsigned: false, limit: 8
      t.integer :tuples_processed, null: true, unsigned: false, limit: 8
      t.integer :tuples_excluded, null: true, unsigned: false, limit: 8

      # pg_class
      t.string :copy_relname, null: true

      # pg_stat_progress_create_index
      t.string :create_index_command, null: true
      t.string :create_index_phase, null: true
      t.integer :lockers_total, null: true, unsigned: false, limit: 8
      t.integer :lockers_done, null: true, unsigned: false, limit: 8
      t.integer :blocks_total, null: true, unsigned: false, limit: 8
      t.integer :blocks_done, null: true, unsigned: false, limit: 8
      t.integer :tuples_total, null: true, unsigned: false, limit: 8
      t.integer :tuples_done, null: true, unsigned: false, limit: 8
      t.integer :partitions_total, null: true, unsigned: false, limit: 8
      t.integer :partitions_done, null: true, unsigned: false, limit: 8

      # pg_class
      t.string :create_index_relname, null: true
      t.string :create_index_index_relname, null: true

      # pg_stat_progress_vacuum
      t.string :vacuum_phase, null: true
      t.integer :heap_blks_total, null: true, unsigned: false, limit: 8
      t.integer :heap_blks_scanned, null: true, unsigned: false, limit: 8
      t.integer :heap_blks_vacuumed, null: true, unsigned: false, limit: 8
      t.integer :index_vacuum_count, null: true, unsigned: false, limit: 8
      t.integer :max_dead_tuples, null: true, unsigned: false, limit: 8
      t.integer :num_dead_tuples, null: true, unsigned: false, limit: 8

      # pg_class
      t.string :vacuum_relname, null: true

      # pg_stat_progress_basebackup
      t.string :basebackup_phase, null: true
      t.integer :backup_total, null: true, unsigned: false, limit: 8
      t.integer :backup_streamed, null: true, unsigned: false, limit: 8
      t.integer :tablespaces_total, null: true, unsigned: false, limit: 8
      t.integer :tablespaces_streamed, null: true, unsigned: false, limit: 8

      # pg_stat_replication
      t.string :replication_state, null: true
      t.string :sent_lsn, null: true
      t.string :write_lsn, null: true
      t.string :flush_lsn, null: true
      t.string :replay_lsn, null: true
      t.integer :write_lag, null: true
      t.integer :flush_lag, null: true
      t.integer :replay_lag, null: true
      t.integer :sync_priority, null: true
      t.string :sync_state, null: true
      t.date :reply_time, null: true

      # pg_stat_wal_receiver
      t.string :status, null: true
      t.string :receive_start_lsn, null: true
      t.integer :receive_start_tli, null: true
      t.string :written_lsn, null: true
      t.string :flushed_lsn, null: true
      t.integer :received_tli, null: true
      t.date :last_msg_send_time, null: true
      t.date :last_msg_receipt_time, null: true
      t.string :latest_end_lsn, null: true
      t.date :latest_end_time, null: true
      t.string :slot_name, null: true
      t.string :sender_host, null: true
      t.integer :sender_port, null: true
      t.string :conninfo, null: true

      # derived columns
      t.string :simplified_query, null: true
      t.string :normalized_query, null: true
      t.string :fingerprint, null: true
    end

    # pg_stat_activity_history update to use low cardinality columns
    execute(<<-SQL)
      ALTER TABLE pg_stat_activity_history
        MODIFY COLUMN wait_event_type LowCardinality(String),
        MODIFY COLUMN wait_event LowCardinality(String),
        MODIFY COLUMN state LowCardinality(String),
        MODIFY COLUMN backend_type LowCardinality(String),
        MODIFY COLUMN locktype LowCardinality(String),
        MODIFY COLUMN mode LowCardinality(String),
        MODIFY COLUMN analyze_phase LowCardinality(String),
        MODIFY COLUMN cluster_phase LowCardinality(String),
        MODIFY COLUMN type LowCardinality(String),
        MODIFY COLUMN create_index_phase LowCardinality(String),
        MODIFY COLUMN vacuum_phase LowCardinality(String),
        MODIFY COLUMN basebackup_phase LowCardinality(String),
        MODIFY COLUMN replication_state LowCardinality(String),
        MODIFY COLUMN sync_state LowCardinality(String),
        MODIFY COLUMN status LowCardinality(String)
    SQL

    # pg_stat_activity_history update to add array columns
    execute(<<-SQL)
      ALTER TABLE pg_stat_activity_history
        ADD COLUMN IF NOT EXISTS user_defined_tag_names Array(String),
        ADD COLUMN IF NOT EXISTS user_defined_tag_values Array(String),
        ADD COLUMN IF NOT EXISTS tables Array(String),
        ADD COLUMN IF NOT EXISTS filter_columns Array(String)
    SQL
  end
end
