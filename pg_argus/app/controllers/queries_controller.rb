class QueriesController < ApplicationController
  def show
    ago = params[:ago].to_i || 15
    start_ts = params[:from] ? params[:from].to_f.to_i : (ago.minutes.ago.to_i * 1000)
    end_ts = params[:to] ? params[:to].to_f.to_i : (Time.current.to_i * 1000)
    group_by = params[:group_by] || []
    aggs = params[:aggs] || ["avg"]

    case params[:id]
    when "saturation.connection.timeseries"
      filters = []
      results = PgStatActivityHistory.query_timeseries(start_ts, end_ts, group_by: group_by, aggs: aggs, filters: filters)
    when "saturation.connection.total"
      filters = []
      results = PgStatActivityHistory.query_total(start_ts, end_ts, group_by: group_by, aggs: aggs, filaters: filters)
    when "saturation.connection.locks.timeseries"
      filters = ["wait_event IS NOT NULL"]
      results = PgStatActivityHistory.query_timeseries(start_ts, end_ts, group_by: group_by, aggs: aggs, filters: filters)
    when "saturation.connection.locks.total"
      filters = ["wait_event IS NOT NULL"]
      results = PgStatActivityHistory.query_total(start_ts, end_ts, group_by: group_by, aggs: aggs, filters: filters)
    when "saturation.connection.idle_transactions.timeseries"
      filters = ["state = 'idle_in_transaction'"]
      results = PgStatActivityHistory.query_timeseries(start_ts, end_ts, group_by: group_by, aggs: aggs, filters: filters)
    when "saturation.connection.idle_transactions.total"
      filters = ["state = 'idle_in_transaction'"]
      results = PgStatActivityHistory.query_total(start_ts, end_ts, group_by: group_by, aggs: aggs, filters: filters)
    when "saturation.connection.active_queries.timeseries"
      filters = ["state = 'active'"]
      results = PgStatActivityHistory.query_timeseries(start_ts, end_ts, group_by: group_by, aggs: aggs, filters: filters)
    when "saturation.connection.active_queries.total"
      filters = ["state = 'active'"]
      results = PgStatActivityHistory.query_total(start_ts, end_ts, group_by: group_by, aggs: aggs, filters: filters)
    when "saturation.connection.slow_transactions.timeseries"
      filters = ["state = 'active'", "NOW() - xact_start > (interval 100 millisecond)"]
      results = PgStatActivityHistory.query_timeseries(start_ts, end_ts, group_by: group_by, aggs: aggs, filters: filters)
    when "saturation.connection.slow_transactions.total"
      filters = ["state = 'active'", "NOW() - xact_start > (interval 100 millisecond)"]
      results = PgStatActivityHistory.query_total(start_ts, end_ts, group_by: group_by, aggs: aggs, filters: filters)
    when "saturation.connection.io.timeseries"
      filters = ["state = 'active'", "wait_event_type = 'IO'"]
      results = PgStatActivityHistory.query_timeseries(start_ts, end_ts, group_by: group_by, aggs: aggs, filters: filters)
    when "saturation.connection.io.total"
      filters = ["state = 'active'", "wait_event_type = 'IO'"]
      results = PgStatActivityHistory.query_total(start_ts, end_ts, group_by: group_by, aggs: aggs, filters: filters)
    when "saturation.cpu.timeseries"
      filters = ["state = 'active'", "wait_event IS NULL"]
      results = PgStatActivityHistory.query_timeseries(start_ts, end_ts, group_by: group_by, aggs: aggs, filters: filters)
    when "saturation.cpu.total"
      filters = ["state = 'active'", "wait_event IS NULL"]
      results = PgStatActivityHistory.query_total(start_ts, end_ts, group_by: group_by, aggs: aggs, filters: filters)
    else
      head :not_found
      return
    end

    render json: results
  end
end
