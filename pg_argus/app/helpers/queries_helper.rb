module QueriesHelper

  # Expected input format:
  # {
  #  "data": [
  #    [timestamp, query, value],
  #    [timestamp, query, value],
  #    ...
  #  ]
  # }
  # Expected output format:
  # {
  #  "labels": [timestamp, timestamp, ...],
  #  "results": [
  #    {
  #      "label": query,
  #      "data": [
  #        [timestamp, value],
  #        [timestamp, value],
  #        ...
  #      ]
  #    },
  #    ...
  #  ]
  # }
  def format_timeseries_data(data)
    # extract the x-axis labels
    labels = results["data"].map { |r| r[0].to_i }.uniq.sort
    # group the data by the group_by column
    grouped = results["data"].group_by { |r| r[1] }
    # extract just 0 and 1 from each row that has now been grouped
    results = grouped.map do |query, rows|
      {
        label: query,
        data: rows.map { |r| [r[0].to_i, r[2].to_f] },
      }
    end
    # for each series fill with nulls for labels that do not have values
    # do this efficiently since each series is sorted by timestamp
    results.each do |series|
      series[:data] = compress_nils(labels, series[:data])
    end
    return {
      labels: labels,
      results: results,
    }
  end

  private
    def compress_nils(labels, series)
      last_was_nil = true
      output = []
      puts ("compressing nils: #{labels} #{series}")
      labels.each do |label|
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
      return output
    end
end
