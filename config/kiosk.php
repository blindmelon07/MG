<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Kiosk mode
    |--------------------------------------------------------------------------
    |
    | Turn this on for the copy of the system running on a kiosk PC. It then
    | serves only the kiosk: the home map, directory, manual, announcements,
    | campus map, chatbot and the students' My Acads pages. Staff login,
    | dashboards, admin and settings pages answer "not found", and every
    | student sign-in is treated as a shared-screen (kiosk) session.
    |
    */

    'mode' => (bool) env('KIOSK_MODE', false),

    /*
    | The kiosk's own on-screen keyboard for its search boxes, chatbot and
    | student sign-in. On by default on a kiosk PC; set KIOSK_KEYBOARD=true
    | to try it on another machine. Phones and tablets keep their own.
    */
    'keyboard' => (bool) env('KIOSK_KEYBOARD', env('KIOSK_MODE', false)),

    /*
    | Route names the kiosk may open. A trailing ".*" covers a whole group.
    */
    'routes' => [
        'home',
        'directory.*',
        'manuals.*',
        'announcements.*',
        'maps.*',
        'chatbot.*',
        'student.*',
        'storage.local',
    ],

];
