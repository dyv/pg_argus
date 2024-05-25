# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `rails
# clickhouse:schema:load`. When creating a new database, `rails clickhouse:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ClickhouseActiverecord::Schema.define(version: 2024_06_01_065942) do

  # TABLE: pg_stat_activity_history
  # SQL: CREATE TABLE default.pg_stat_activity_history ( `timestamp` DateTime64(3), `datname` String, `pid` UInt32, `leader_pid` Nullable(UInt32), `usename` String, `application_name` Nullable(String), `client_addr` Nullable(String), `client_hostname` Nullable(String), `client_port` Nullable(UInt32), `backend_start` Nullable(DateTime64(3)), `xact_start` Nullable(DateTime64(3)), `query_start` Nullable(DateTime64(3)), `state_change` Nullable(DateTime64(3)), `wait_event_type` LowCardinality(String), `wait_event` LowCardinality(String), `state` LowCardinality(String), `backend_xid` Nullable(UInt32), `backend_xmin` Nullable(UInt32), `query_id` Nullable(Int64), `query` Nullable(String), `backend_type` LowCardinality(String), `locktype` LowCardinality(String), `page` Nullable(UInt32), `tuple` Nullable(UInt32), `virtualxid` Nullable(String), `transactionid` Nullable(UInt32), `classid` Nullable(UInt32), `objid` Nullable(UInt32), `objsubid` Nullable(UInt32), `virtualtransaction` Nullable(String), `mode` LowCardinality(String), `granted` Nullable(Bool), `fastpath` Nullable(Bool), `waitstart` Nullable(DateTime64(3)), `lock_relname` Nullable(String), `analyze_phase` LowCardinality(String), `sample_blks_total` Nullable(Int64), `sample_blks_scanned` Nullable(Int64), `ext_stats_total` Nullable(Int64), `ext_stats_computed` Nullable(Int64), `child_tables_total` Nullable(Int64), `child_tables_done` Nullable(Int64), `analyze_relname` Nullable(String), `cluster_command` Nullable(String), `cluster_phase` LowCardinality(String), `heap_tuples_scanned` Nullable(Int64), `heap_tuples_written` Nullable(Int64), `cluster_heap_blks_total` Nullable(Int64), `cluster_heap_blks_scanned` Nullable(Int64), `index_rebuild_count` Nullable(Int64), `cluster_relname` Nullable(String), `cluster_index_relname` Nullable(String), `copy_command` Nullable(String), `type` LowCardinality(String), `bytes_processed` Nullable(Int64), `bytes_total` Nullable(Int64), `tuples_processed` Nullable(Int64), `tuples_excluded` Nullable(Int64), `copy_relname` Nullable(String), `create_index_command` Nullable(String), `create_index_phase` LowCardinality(String), `lockers_total` Nullable(Int64), `lockers_done` Nullable(Int64), `blocks_total` Nullable(Int64), `blocks_done` Nullable(Int64), `tuples_total` Nullable(Int64), `tuples_done` Nullable(Int64), `partitions_total` Nullable(Int64), `partitions_done` Nullable(Int64), `create_index_relname` Nullable(String), `create_index_index_relname` Nullable(String), `vacuum_phase` LowCardinality(String), `heap_blks_total` Nullable(Int64), `heap_blks_scanned` Nullable(Int64), `heap_blks_vacuumed` Nullable(Int64), `index_vacuum_count` Nullable(Int64), `max_dead_tuples` Nullable(Int64), `num_dead_tuples` Nullable(Int64), `vacuum_relname` Nullable(String), `basebackup_phase` LowCardinality(String), `backup_total` Nullable(Int64), `backup_streamed` Nullable(Int64), `tablespaces_total` Nullable(Int64), `tablespaces_streamed` Nullable(Int64), `replication_state` LowCardinality(String), `sent_lsn` Nullable(String), `write_lsn` Nullable(String), `flush_lsn` Nullable(String), `replay_lsn` Nullable(String), `write_lag` Nullable(UInt32), `flush_lag` Nullable(UInt32), `replay_lag` Nullable(UInt32), `sync_priority` Nullable(UInt32), `sync_state` LowCardinality(String), `reply_time` Nullable(Date), `status` LowCardinality(String), `receive_start_lsn` Nullable(String), `receive_start_tli` Nullable(UInt32), `written_lsn` Nullable(String), `flushed_lsn` Nullable(String), `received_tli` Nullable(UInt32), `last_msg_send_time` Nullable(Date), `last_msg_receipt_time` Nullable(Date), `latest_end_lsn` Nullable(String), `latest_end_time` Nullable(Date), `slot_name` Nullable(String), `sender_host` Nullable(String), `sender_port` Nullable(UInt32), `conninfo` Nullable(String), `simplified_query` Nullable(String), `normalized_query` Nullable(String), `fingerprint` Nullable(String), `user_defined_tag_names` Array(String), `user_defined_tag_values` Array(String), `tables` Array(String), `filter_columns` Array(String) ) ENGINE = MergeTree PARTITION BY toYYYYMM(timestamp) ORDER BY timestamp SETTINGS index_granularity = 8192
  create_table "pg_stat_activity_history", id: false, options: "MergeTree PARTITION BY toYYYYMM(timestamp) ORDER BY timestamp SETTINGS index_granularity = 8192", force: :cascade do |t|
    t.datetime "timestamp", precision: 3, null: false
    t.string "datname", null: false
    t.integer "pid", null: false
    t.integer "leader_pid"
    t.string "usename", null: false
    t.string "application_name"
    t.string "client_addr"
    t.string "client_hostname"
    t.integer "client_port"
    t.datetime "backend_start", precision: 3
    t.datetime "xact_start", precision: 3
    t.datetime "query_start", precision: 3
    t.datetime "state_change", precision: 3
    t.string "wait_event_type", null: false
    t.string "wait_event", null: false
    t.string "state", null: false
    t.integer "backend_xid"
    t.integer "backend_xmin"
    t.integer "query_id", unsigned: false, limit: 8
    t.string "query"
    t.string "backend_type", null: false
    t.string "locktype", null: false
    t.integer "page"
    t.integer "tuple"
    t.string "virtualxid"
    t.integer "transactionid"
    t.integer "classid"
    t.integer "objid"
    t.integer "objsubid"
    t.string "virtualtransaction"
    t.string "mode", null: false
    t.boolean "granted"
    t.boolean "fastpath"
    t.datetime "waitstart", precision: 3
    t.string "lock_relname"
    t.string "analyze_phase", null: false
    t.integer "sample_blks_total", unsigned: false, limit: 8
    t.integer "sample_blks_scanned", unsigned: false, limit: 8
    t.integer "ext_stats_total", unsigned: false, limit: 8
    t.integer "ext_stats_computed", unsigned: false, limit: 8
    t.integer "child_tables_total", unsigned: false, limit: 8
    t.integer "child_tables_done", unsigned: false, limit: 8
    t.string "analyze_relname"
    t.string "cluster_command"
    t.string "cluster_phase", null: false
    t.integer "heap_tuples_scanned", unsigned: false, limit: 8
    t.integer "heap_tuples_written", unsigned: false, limit: 8
    t.integer "cluster_heap_blks_total", unsigned: false, limit: 8
    t.integer "cluster_heap_blks_scanned", unsigned: false, limit: 8
    t.integer "index_rebuild_count", unsigned: false, limit: 8
    t.string "cluster_relname"
    t.string "cluster_index_relname"
    t.string "copy_command"
    t.string "type", null: false
    t.integer "bytes_processed", unsigned: false, limit: 8
    t.integer "bytes_total", unsigned: false, limit: 8
    t.integer "tuples_processed", unsigned: false, limit: 8
    t.integer "tuples_excluded", unsigned: false, limit: 8
    t.string "copy_relname"
    t.string "create_index_command"
    t.string "create_index_phase", null: false
    t.integer "lockers_total", unsigned: false, limit: 8
    t.integer "lockers_done", unsigned: false, limit: 8
    t.integer "blocks_total", unsigned: false, limit: 8
    t.integer "blocks_done", unsigned: false, limit: 8
    t.integer "tuples_total", unsigned: false, limit: 8
    t.integer "tuples_done", unsigned: false, limit: 8
    t.integer "partitions_total", unsigned: false, limit: 8
    t.integer "partitions_done", unsigned: false, limit: 8
    t.string "create_index_relname"
    t.string "create_index_index_relname"
    t.string "vacuum_phase", null: false
    t.integer "heap_blks_total", unsigned: false, limit: 8
    t.integer "heap_blks_scanned", unsigned: false, limit: 8
    t.integer "heap_blks_vacuumed", unsigned: false, limit: 8
    t.integer "index_vacuum_count", unsigned: false, limit: 8
    t.integer "max_dead_tuples", unsigned: false, limit: 8
    t.integer "num_dead_tuples", unsigned: false, limit: 8
    t.string "vacuum_relname"
    t.string "basebackup_phase", null: false
    t.integer "backup_total", unsigned: false, limit: 8
    t.integer "backup_streamed", unsigned: false, limit: 8
    t.integer "tablespaces_total", unsigned: false, limit: 8
    t.integer "tablespaces_streamed", unsigned: false, limit: 8
    t.string "replication_state", null: false
    t.string "sent_lsn"
    t.string "write_lsn"
    t.string "flush_lsn"
    t.string "replay_lsn"
    t.integer "write_lag"
    t.integer "flush_lag"
    t.integer "replay_lag"
    t.integer "sync_priority"
    t.string "sync_state", null: false
    t.date "reply_time"
    t.string "status", null: false
    t.string "receive_start_lsn"
    t.integer "receive_start_tli"
    t.string "written_lsn"
    t.string "flushed_lsn"
    t.integer "received_tli"
    t.date "last_msg_send_time"
    t.date "last_msg_receipt_time"
    t.string "latest_end_lsn"
    t.date "latest_end_time"
    t.string "slot_name"
    t.string "sender_host"
    t.integer "sender_port"
    t.string "conninfo"
    t.string "simplified_query"
    t.string "normalized_query"
    t.string "fingerprint"
    t.string "user_defined_tag_names", array: true, null: false
    t.string "user_defined_tag_values", array: true, null: false
    t.string "tables", array: true, null: false
    t.string "filter_columns", array: true, null: false
  end

end
