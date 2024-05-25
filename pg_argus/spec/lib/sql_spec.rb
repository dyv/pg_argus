require 'sql'

RSpec.describe Sql do
  describe '#simplified' do
    tests = [
      { name: "simple_select", input: 'SELECT * FROM users WHERE a = $1', output: 'SELECT ... FROM users WHERE a = ?' },
      { name: "simple_insert", input: 'INSERT INTO users (a, b, c) VALUES (1, 2, 3)', output: 'INSERT INTO users (...) VALUES (...)'},
      { name: "simple_update", input: 'UPDATE users SET a = $1 WHERE b = $2', output: 'UPDATE users SET a = ? WHERE b = ?' },
      { name: "simple_delete", input: 'DELETE FROM users WHERE a = 1', output: 'DELETE FROM users WHERE a = ?' },
      { name: "large_in_clause",
        input: 'SELECT * FROM users WHERE a IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10)',
        output: 'SELECT ... FROM users WHERE a IN (...)' },
      { name: "insert_many_rows",
        input: 'INSERT INTO users (a) VALUES (1), (4)',
        output: 'INSERT INTO users (...) VALUES (many_lists)' },
    ]

    tests.each do |test|
      it "simplifies #{test[:name]} correctly", name.to_sym do
        sql = Sql.new(test[:input])
        expect(sql.simplified).to eq(test[:output])
      end
    end
  end
end
