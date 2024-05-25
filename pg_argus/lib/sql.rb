require 'pg_query'

class Sql
  attr_reader :sql, :deparsed, :parsed, :normalized, :fingerprint, :tables, :filter_columns

  def initialize(sql)
    @sql = sql
    @parsed = PgQuery.parse(sql)
    @deparsed = parsed.deparse
    @normalized = PgQuery.normalize(sql)
    @fingerprint = @parsed.fingerprint
    @tables = @parsed.tables
    @filter_columns = @parsed.filter_columns
  end

  Truncation = Struct.new(:location, :node_type, :is_array)

  def simplified
    norm = PgQuery::parse(normalized)

    truncations = find_truncations(norm)
    truncations.sort_by! { |t| [-t.location.size] }
    tree = norm.dup_tree
    # The following logicis copied from:
    # https://github.com/pganalyze/pg_query/blob/f23f1dfe39c67d8513f3e7ebfacfeb4d9235327e/lib/pg_query/truncate.rb
    truncations.each do |truncation|
      parsed.send(:find_tree_location, tree, truncation.location) do |node, _k|
        dummy_column_ref = PgQuery::Node.new(column_ref: PgQuery::ColumnRef.new(fields: [PgQuery::Node.new(string: PgQuery::String.new(sval: '…'))]))
        case truncation.node_type
        when :target_list
          res_target_name = '…' if node.is_a?(PgQuery::UpdateStmt) || node.is_a?(PgQuery::OnConflictClause)
          node.target_list.replace(
            [
              PgQuery::Node.new(res_target: PgQuery::ResTarget.new(name: res_target_name, val: dummy_column_ref))
            ]
          )
        when :where_clause
          node.where_clause = dummy_column_ref
        when :list
          node.list = PgQuery::List.new(items: [dummy_column_ref])
        when :param_ref
          node.param_ref = PgQuery::ParamRef.new(number: 0)
        when :values_lists
          if node.values_lists.size > 1
            column_ref = PgQuery::Node.new(column_ref: PgQuery::ColumnRef.new(fields: [PgQuery::Node.new(string: PgQuery::String.new(sval: '‥'))]))
            node.values_lists.replace(
              [
                PgQuery::Node.new(list: PgQuery::List.new(items: [column_ref])),
              ]
            )
          else
            node.values_lists.replace(
              [
                PgQuery::Node.new(list: PgQuery::List.new(items: [dummy_column_ref])),
              ]
            )
          end
        when :ctequery
          node.ctequery = PgQuery::Node.new(select_stmt: PgQuery::SelectStmt.new(where_clause: dummy_column_ref, op: :SETOP_NONE))
        when :cols
          node.cols.replace([PgQuery::Node.from(PgQuery::ResTarget.new(name: '…'))]) if node.is_a?(PgQuery::InsertStmt)
        else
          raise ArgumentError, format('Unexpected truncation node type: %s', truncation.node_type)
        end
      end
    end
    PgQuery.deparse(tree).gsub('SELECT WHERE "…"', '...').gsub('"…"', '...').gsub('"‥"', 'many_lists')
  end

  private

  def find_truncations(norm) # rubocop:disable Metrics/CyclomaticComplexity
    truncations = []
    norm.walk! do |node, k, v, location|
      case k
      when :target_list
        next unless node.is_a?(PgQuery::SelectStmt)
        truncations << Truncation.new(location, :target_list, true)
      when :param_ref
        truncations << Truncation.new(location, :param_ref, false)
      when :values_lists
        truncations << Truncation.new(location, :values_lists, false)
      when :ctequery
        next unless node.is_a?(PgQuery::CommonTableExpr)
        truncations << Truncation.new(location, :ctequery, false)
      when :cols
        next unless node.is_a?(PgQuery::InsertStmt)
        truncations << Truncation.new(location, :cols, true)
      when :list
        truncations << Truncation.new(location, :list, true)
      end
    end

    truncations
  end
end
