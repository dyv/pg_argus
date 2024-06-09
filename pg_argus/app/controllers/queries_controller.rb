class QueriesController < ApplicationController
  def parse_duration(str)
    match = str.match(/\A(\d+)([smhdM])\z/)
    return 0 unless match

    value = match[1].to_i
    unit = match[2]

    duration = case unit
    when 's' then value.seconds.ago
    when 'm' then value.minutes.ago
    when 'h' then value.hours.ago
    when 'd' then value.days.ago
    when 'M' then value.months.ago
    end

    return duration
  end

  def show
    age = params[:ago] ? parse_duration(params[:ago]) :  15.minutes.ago
    start_ts = params[:from] ? params[:from].to_f.to_i : (age.to_i * 1000)
    end_ts = params[:until] ? params[:until].to_f.to_i : (Time.current.to_i * 1000)
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
