<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Student Login Slips</title>
    <style>
        @page { margin: 0; }
        body { margin: 0; font-family: DejaVu Sans, sans-serif; color: #111; font-size: 8.5pt; }

        /*
         * One slip is a strip a quarter of a short bond page: 8.5in x 2.75in (612pt x 198pt).
         * dompdf ignores box-sizing, so the height here is 198pt minus the vertical padding
         * and the cut line; the width is left to fill the page.
         */
        .slip { height: 177pt; padding: 12pt 22pt 8pt; position: relative; overflow: hidden; }
        .slip.cut { height: 176pt; border-bottom: 1pt dashed #888; }
        .page-break { page-break-after: always; }

        .header { width: 100%; border-collapse: collapse; border-bottom: 1.5pt solid #7a1f1f; }
        .header td { vertical-align: middle; padding-bottom: 4pt; }
        .logo { width: 34pt; height: 34pt; }
        .school { font-size: 12pt; font-weight: bold; letter-spacing: .5pt; text-transform: uppercase; color: #7a1f1f; }
        .address { font-size: 7.5pt; color: #444; }
        .title { text-align: right; font-size: 9pt; font-weight: bold; text-transform: uppercase; color: #333; }

        .body { width: 100%; border-collapse: collapse; margin-top: 6pt; }
        .body td { padding: 1.5pt 0; vertical-align: top; }
        .label { width: 82pt; color: #555; }
        .value { font-weight: bold; }
        .credential { font-family: DejaVu Sans Mono, monospace; font-size: 12pt; letter-spacing: 1pt; }
        .steps { padding-left: 14pt !important; color: #333; font-size: 7.5pt; line-height: 1.35; }

        .footer { position: absolute; left: 22pt; right: 22pt; bottom: 7pt; border-top: .5pt solid #bbb; padding-top: 2pt; font-size: 6.5pt; color: #555; }
        .footer .right { float: right; }
    </style>
</head>
<body>
@foreach ($slips as $slip)
    <div class="slip {{ $perPage > 1 && ($loop->iteration % $perPage !== 0) && ! $loop->last ? 'cut' : '' }}">
        <table class="header">
            <tr>
                @if ($logo)
                    <td style="width: 40pt;"><img class="logo" src="{{ $logo }}" alt=""></td>
                @endif
                <td>
                    <div class="school">{{ $school['name'] }}</div>
                    <div class="address">{{ $school['address'] }}@if ($school['contact']) · {{ $school['contact'] }}@endif</div>
                </td>
                <td class="title">Student Portal<br>Login Slip</td>
            </tr>
        </table>

        <table class="body">
            <tr>
                <td style="width: 52%;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td class="label">Student</td><td class="value">{{ $slip['name'] }}</td></tr>
                        <tr><td class="label">Level / Section</td><td>{{ collect([$slip['education_level'], $slip['grade_level'], $slip['section']])->filter()->join(' · ') ?: '—' }}</td></tr>
                        <tr><td class="label">Student #</td><td class="value credential">{{ $slip['student_number'] }}</td></tr>
                        <tr><td class="label">Temporary password</td><td class="value credential">{{ $slip['password'] }}</td></tr>
                    </table>
                </td>
                <td class="steps">
                    <strong>How to sign in</strong><br>
                    1. Go to {{ $portalUrl }}<br>
                    2. Enter your student # and the temporary password.<br>
                    3. Choose a new password when asked. This temporary password then stops working.
                </td>
            </tr>
        </table>

        <div class="footer">
            <span class="right">Issued {{ $issuedAt->format('M j, Y') }}</span>
            {{ $school['footer'] }}
        </div>
    </div>
    @if ($perPage > 1 && $loop->iteration % $perPage === 0 && ! $loop->last)
        <div class="page-break"></div>
    @endif
@endforeach
</body>
</html>
