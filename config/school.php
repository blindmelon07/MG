<?php

return [

    /*
    |--------------------------------------------------------------------------
    | School Identity
    |--------------------------------------------------------------------------
    |
    | Printed in the header and footer of documents such as student login
    | slips. Override any of these in .env without touching the code.
    |
    */

    'name' => env('SCHOOL_NAME', 'Aemilianum College Inc.'),

    'address' => env('SCHOOL_ADDRESS', 'Piot, Sorsogon City, Sorsogon'),

    'contact' => env('SCHOOL_CONTACT'),

    'footer' => env('SCHOOL_FOOTER', 'Keep this slip private. Never share your password with anyone.'),

    'logo' => public_path('logo.png'),

];
