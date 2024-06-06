class PgMonitorJob < ApplicationJob
  include GoodJob::ActiveJobExtensions::Concurrency

  good_job_control_concurrency_with(
    max_concurrent: 1,
    enqueue_limit: 1,
    perform_limit: 1,
    key: -> { "#{self.class.name}-#{arguments}}" }
  )

  def every_second(&block)
    seconds = 1
    last_tick = Time.current
    loop do
      break if GoodJob.current_thread_shutting_down?
      now = Time.current
      if now - last_tick >= seconds
          last_tick = now
        yield
      end
      wait = last_tick + seconds - Time.current
      puts "sleeping: #{wait}"
      sleep(wait)
    end
  end

  def perform(*args)
    puts "PgMonitorJob.perform"
    # Queue up the next attemp

    begin
      puts "connecting to pg..."
      dsn = "host=localhost port=5432 dbname=postgres user=postgres password=postgres"
      pgconn = PG.connect(dsn)
      begin
        every_second do
          puts "collecting: #{Time.current}"
          start = Time.current
          PgStatActivityHistory.bulk_load!(Time.current, pgconn)
          puts "bulk_load took #{(Time.current - start).in_milliseconds} milliseconds"
        end
      ensure
        pgconn.close
      end
    rescue StandardError => e
      puts "error: #{e.class} #{e.message}"
      e.backtrace.each do |line|
        puts line
      end
      raise e
    ensure
      puts "re-enqueueing PgMonitorJob"
      PgMonitorJob.perform_later
    end
  end
end
