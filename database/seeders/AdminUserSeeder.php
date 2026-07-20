<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@aemilianum.edu.ph'],
            [
                'name' => 'Kiosk Administrator',
                'password' => 'password',
                'role' => 'super_admin',
                'email_verified_at' => now(),
            ],
        );
    }
}
