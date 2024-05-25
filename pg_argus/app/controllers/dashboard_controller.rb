class DashboardController < ApplicationController
  def index
  end

  def filter_nils(data)
    filtered = []
    last_was_nil = false

    data.each do |timestamp, value|
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
    PgStatActivityHistory.execute(<<-SQL)
      SELECT COUNT(*) as count FROM pg_stat_activity_history
    SQL
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
