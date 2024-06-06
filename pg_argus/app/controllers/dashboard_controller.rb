class DashboardController < ApplicationController
  def index
  end

  def filter_nils(series)
    filtered = []
    last_was_nil = false

    series.each do |data|
      timestamp = data[0]
      value = data[1]
      if value.nil?
        filtered << [timestamp, value] if !last_was_nil
        last_was_nil = true
      else
        filtered << [timestamp, value]
        last_was_nil = false
      end
    end

    filtered
  end

  def show
    start_ts = 15.minutes.ago.to_i * 1000
    end_ts = Time.current.to_i * 1000
    results = PgStatActivityHistory.connection.execute(<<-SQL)
      SELECT toUnixTimestamp(toStartOfInterval(timestamp, INTERVAL 15 SECONDS)) * 1000 as time, simplified_query, count(*) as total
      FROM pg_stat_activity_history
      WHERE ( time >= '#{start_ts}' AND time <= '#{end_ts}')
      GROUP BY simplified_query, time
      ORDER BY time ASC, simplified_query ASC LIMIT 1000
    SQL

    puts results
    # extract all unique timestamps returned by query in a sorted list
    labels = results["data"].map { |r| r[0].to_i }.uniq.sort
    grouped = results["data"].group_by { |r| r[1] }
    # extract just 0 and 1 from each row that has now been grouped
    results = grouped.map do |query, rows|
      {
        label: query,
        fill: false,
        data: rows.map { |r| [r[0].to_i, r[2].to_f] },
      }
    end
    # for each series fill with nulls for labels that do not have values
    # do this efficiently since each series is sorted by timestamp
    last_was_nil = true
    results.each do |series|
      output = []
      series[:data] = labels.each do |label|
        point = series[:data].first
        if point && point[0] == label
          series[:data].shift
          last_was_nil = false
          output << point
        else
          if !last_was_nil
            last_was_nil = true
            output << [label, nil]
          end
        end
      end
      series[:data] = output
    end
    # filter out nils from each series so that they are only kept adjacent to non nil data
    # puts "pre filter: #{results}"
    # results.each do |series|
    #   series[:data] = filter_nils(series[:data])
    # end
    puts "RESULTS: #{results}"


    render json: {
      labels: labels,
      results: results,
    }
    return
    return
    begin
      results = warehouse.query(<<-SQL)
        PIVOT
          (
            SELECT epoch_ms(timestamp) as timestamp, normalized_query, COUNT(*) as count
            FROM pg_stat_activity_history
            GROUP BY epoch_ms(timestamp), normalized_query
          )
        ON timestamp
        USING sum(count)
        GROUP BY normalized_query
      SQL

      # columns are query and then timestamps
      labels = results.columns.map { |c| c.name.to_i}[1..nil].push(Time.current.to_i * 1000)

      data = {
        name: params["query"],
        labels: labels,
        series: [],
      }
      results.each do |row|
        values = row[1..nil].map { |v| v == 0 ? nil : v }
        values = labels.zip(values)
        # Filter out nulls from values, but keep one on either side of each non-null value
        values = filter_nils(values)
        data[:series].push({name: row[0].strip[nil..150], data: values, type: "line"})
      end
      render json: data
    ensure
      warehouse.close!
    end
  end
end
