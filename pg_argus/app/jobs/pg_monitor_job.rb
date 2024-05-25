class PgMonitorJob < ApplicationJob
  include GoodJob::ActiveJobExtensions::Concurrency

  good_job_control_concurrency_with(
    max_concurrent: 1,
    enqueue_limit: 1,
    perform_limit: 1,
    key: -> { "#{self.class.name}-#{arguments}}" }
  )

  def perform(*args)
    puts "PgMonitorJob.perform"
    # Queue up the next attemp

    begin
      puts "connecting to pg..."
      dsn = "host=localhost port=5432 dbname=postgres user=postgres password=postgres"
      pgconn = PG.connect(dsn)
      begin
        (1..10).each do |_i|
          start = Time.current
          PgStatActivityHistory.bulk_load!(Time.current, pgconn)
          puts "bulk_load took #{(Time.current - start).in_milliseconds} milliseconds"
        end
      ensure
        pgconn.close
        sleep(5)
      end
    rescue StandardError => e
      puts "error: #{e.class} #{e.message}"
      e.backtrace.each do |line|
        puts line
      end
      raise e
    ensure
      sleep(1)
      puts "re-enqueueing PgMonitorJob"
      PgMonitorJob.perform_later
    end
  end
end
