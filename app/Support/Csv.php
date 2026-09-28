<?php

namespace App\Support;

class Csv
{
    /**
     * Neutralize spreadsheet formula injection: a cell such as "=HYPERLINK(...)"
     * in a student name would otherwise run when the export is opened in Excel.
     *
     * @param  array<int, string|int|float|null>  $row
     * @return list<string>
     */
    public static function safeRow(array $row): array
    {
        return array_values(array_map(function (string|int|float|null $value): string {
            $value = (string) $value;

            if ($value !== '' && ! is_numeric($value) && in_array($value[0], ['=', '+', '-', '@', "\t", "\r"], true)) {
                return "'".$value;
            }

            return $value;
        }, $row));
    }

    /**
     * @param  list<string>  $header
     * @param  iterable<array<int, string|int|float|null>>  $rows
     */
    public static function write(mixed $handle, array $header, iterable $rows): void
    {
        fputcsv($handle, $header);

        foreach ($rows as $row) {
            fputcsv($handle, self::safeRow($row));
        }
    }
}
