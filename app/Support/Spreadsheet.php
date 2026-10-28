<?php

namespace App\Support;

use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet as Workbook;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Reading uploaded Excel/CSV files and sending Excel templates.
 */
class Spreadsheet
{
    /**
     * Rows of the first sheet (Excel) or of the CSV, as strings.
     *
     * @return list<list<string|null>>
     */
    public static function rows(string $path, string $extension): array
    {
        $extension = strtolower($extension);

        if (in_array($extension, ['csv', 'txt'], true)) {
            $handle = fopen($path, 'r');

            if ($handle === false) {
                abort(422, 'Unable to read the uploaded file.');
            }

            $rows = [];

            while (($row = fgetcsv($handle)) !== false) {
                $rows[] = $row;
            }

            fclose($handle);

            return $rows;
        }

        $reader = IOFactory::createReaderForFile($path);
        $reader->setReadDataOnly(true);

        return array_values(array_map(
            fn (array $row) => array_values(array_map(fn ($value) => $value === null ? null : (string) $value, $row)),
            $reader->load($path)->getSheet(0)->toArray(null, false, false),
        ));
    }

    /**
     * Lower-cased header names; a UTF-8 byte order mark from Excel's CSV export is dropped.
     *
     * @param  list<string|null>  $row
     * @return list<string>
     */
    public static function header(array $row): array
    {
        return array_map(fn ($column) => strtolower(trim((string) $column, " \t\n\r\0\x0B\u{FEFF}")), $row);
    }

    public static function isBlank(array $row): bool
    {
        return count(array_filter($row, fn ($value) => trim((string) $value) !== '')) === 0;
    }

    public static function column(int $index): string
    {
        return Coordinate::stringFromColumnIndex($index);
    }

    public static function addDropdown(Worksheet $sheet, string $range, string $formula, string $prompt, bool $allowBlank = false): void
    {
        $validation = new DataValidation;
        $validation->setType(DataValidation::TYPE_LIST)
            ->setErrorStyle(DataValidation::STYLE_STOP)
            ->setAllowBlank($allowBlank)
            ->setShowDropDown(true)
            ->setShowErrorMessage(true)
            ->setShowInputMessage(true)
            ->setError('Choose a value from the list.')
            ->setPrompt($prompt)
            ->setFormula1($formula);

        $sheet->setDataValidation($range, $validation);
    }

    public static function download(Workbook $workbook, string $filename): StreamedResponse
    {
        $workbook->setActiveSheetIndex(0);

        return response()->streamDownload(function () use ($workbook) {
            (new Xlsx($workbook))->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }
}
