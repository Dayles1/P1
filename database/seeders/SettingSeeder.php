<?php

namespace Database\Seeders;

use App\Domain\AccessControl\Models\Role;
use App\Domain\Setting\Models\Setting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SettingSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            foreach ($this->defaults() as $setting) {
                Setting::query()->updateOrCreate(
                    ['key' => $setting['key']],
                    [
                        'value' => Setting::normalizeValue($setting['value'], $setting['type']),
                        'type' => $setting['type'],
                        'group' => $setting['group'],
                        'is_public' => $setting['is_public'],
                        'is_locked' => $setting['is_locked'],
                        'is_required' => $setting['is_required'] ?? true,
                    ]
                );
            }
        });
    }

    private function defaults(): array
    {
        return [
            // AUTH
            [
                'key' => 'auth.registration_open',
                'value' => true,
                'type' => Setting::TYPE_BOOLEAN,
                'group' => Setting::GROUP_AUTH,
                'is_public' => true,
                'is_locked' => false,
            ],
            [
                'key' => 'auth.login_open',
                'value' => true,
                'type' => Setting::TYPE_BOOLEAN,
                'group' => Setting::GROUP_AUTH,
                'is_public' => true,
                'is_locked' => false,
            ],
            [
                'key' => 'auth.email_verification_required',
                'value' => true,
                'type' => Setting::TYPE_BOOLEAN,
                'group' => Setting::GROUP_AUTH,
                'is_public' => true,
                'is_locked' => false,
            ],
            [
                'key' => 'auth.default_role_id',
                'value' => Role::query()->where('code', Role::USER)->value('id') ?? 0,
                'type' => Setting::TYPE_INTEGER,
                'group' => Setting::GROUP_AUTH,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'auth.max_register_users_count',
                'value' => 1000,
                'type' => Setting::TYPE_INTEGER,
                'group' => Setting::GROUP_AUTH,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'auth.max_users_count',
                'value' => 10000,
                'type' => Setting::TYPE_INTEGER,
                'group' => Setting::GROUP_AUTH,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'auth.max_login_attempts',
                'value' => 5,
                'type' => Setting::TYPE_INTEGER,
                'group' => Setting::GROUP_AUTH,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'auth.lockout_minutes',
                'value' => 15,
                'type' => Setting::TYPE_INTEGER,
                'group' => Setting::GROUP_AUTH,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'auth.session_lifetime',
                'value' => 120,
                'type' => Setting::TYPE_INTEGER,
                'group' => Setting::GROUP_AUTH,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'auth.remember_me_enabled',
                'value' => true,
                'type' => Setting::TYPE_BOOLEAN,
                'group' => Setting::GROUP_AUTH,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'auth.allowed_login_role_ids',
                'value' => [],
                'type' => Setting::TYPE_JSON,
                'group' => Setting::GROUP_AUTH,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'auth.protect_superadmin',
                'value' => true,
                'type' => Setting::TYPE_BOOLEAN,
                'group' => Setting::GROUP_AUTH,
                'is_public' => false,
                'is_locked' => true,
            ],

            // SYSTEM
            [
                'key' => 'system.site_name',
                'value' => 'IziTruck',
                'type' => Setting::TYPE_STRING,
                'group' => Setting::GROUP_SYSTEM,
                'is_public' => true,
                'is_locked' => false,
            ],
            [
                'key' => 'system.timezone',
                'value' => 'UTC',
                'type' => Setting::TYPE_STRING,
                'group' => Setting::GROUP_SYSTEM,
                'is_public' => true,
                'is_locked' => false,
            ],
            [
                'key' => 'system.favicon',
                'value' => '/favicon.ico',
                'type' => Setting::TYPE_STRING,
                'group' => Setting::GROUP_SYSTEM,
                'is_public' => true,
                'is_locked' => false,
                'is_required' => false,
            ],

            // LOCALIZATION
            [
                'key' => 'localization.default_locale',
                'value' => 'uz',
                'type' => Setting::TYPE_STRING,
                'group' => Setting::GROUP_LOCALIZATION,
                'is_public' => true,
                'is_locked' => false,
            ],
            [
                'key' => 'localization.fallback_locale',
                'value' => 'en',
                'type' => Setting::TYPE_STRING,
                'group' => Setting::GROUP_LOCALIZATION,
                'is_public' => true,
                'is_locked' => false,
            ],
            [
                'key' => 'localization.allow_locale_switch',
                'value' => true,
                'type' => Setting::TYPE_BOOLEAN,
                'group' => Setting::GROUP_LOCALIZATION,
                'is_public' => true,
                'is_locked' => false,
            ],
            [
                'key' => 'localization.auto_detect_browser_locale',
                'value' => true,
                'type' => Setting::TYPE_BOOLEAN,
                'group' => Setting::GROUP_LOCALIZATION,
                'is_public' => true,
                'is_locked' => false,
            ],

            // UPLOAD
            [
                'key' => 'upload.max_upload_size',
                'value' => 10240,
                'type' => Setting::TYPE_INTEGER,
                'group' => Setting::GROUP_UPLOAD,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'upload.allowed_extensions',
                'value' => [
                    'jpg',
                    'jpeg',
                    'png',
                    'gif',
                    'webp',
                    'svg',
                    'bmp',
                    'ico',
                    'tiff',
                    'tif',

                    'pdf',

                    'doc',
                    'docx',
                    'odt',
                    'rtf',
                    'txt',

                    'xls',
                    'xlsx',
                    'ods',
                    'csv',

                    'ppt',
                    'pptx',
                    'odp',

                    'zip',
                    'rar',
                    '7z',

                    'mp3',
                    'wav',
                    'ogg',
                    'm4a',
                    'aac',

                    'mp4',
                    'mov',
                    'avi',
                    'mkv',
                    'webm',
                    'wmv',
                ],
                'type' => Setting::TYPE_JSON,
                'group' => Setting::GROUP_UPLOAD,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'upload.allowed_mime_types',
                'value' => ['image/jpeg', 'image/png', 'application/pdf'],
                'type' => Setting::TYPE_JSON,
                'group' => Setting::GROUP_UPLOAD,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'upload.max_image_width',
                'value' => 4096,
                'type' => Setting::TYPE_INTEGER,
                'group' => Setting::GROUP_UPLOAD,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'upload.max_image_height',
                'value' => 4096,
                'type' => Setting::TYPE_INTEGER,
                'group' => Setting::GROUP_UPLOAD,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'upload.max_video_size',
                'value' => 51200,
                'type' => Setting::TYPE_INTEGER,
                'group' => Setting::GROUP_UPLOAD,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'upload.max_document_size',
                'value' => 20480,
                'type' => Setting::TYPE_INTEGER,
                'group' => Setting::GROUP_UPLOAD,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'upload.image_quality',
                'value' => 85,
                'type' => Setting::TYPE_INTEGER,
                'group' => Setting::GROUP_UPLOAD,
                'is_public' => false,
                'is_locked' => false,
            ],

            // NOTIFICATION
            [
                'key' => 'notification.database',
                'value' => true,
                'type' => Setting::TYPE_BOOLEAN,
                'group' => Setting::GROUP_NOTIFICATION,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'notification.email',
                'value' => true,
                'type' => Setting::TYPE_BOOLEAN,
                'group' => Setting::GROUP_NOTIFICATION,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'notification.telegram',
                'value' => false,
                'type' => Setting::TYPE_BOOLEAN,
                'group' => Setting::GROUP_NOTIFICATION,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'notification.push',
                'value' => false,
                'type' => Setting::TYPE_BOOLEAN,
                'group' => Setting::GROUP_NOTIFICATION,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'notification.sms',
                'value' => false,
                'type' => Setting::TYPE_BOOLEAN,
                'group' => Setting::GROUP_NOTIFICATION,
                'is_public' => false,
                'is_locked' => false,
            ],

            // USER
            [
                'key' => 'user.allow_avatar_upload',
                'value' => true,
                'type' => Setting::TYPE_BOOLEAN,
                'group' => Setting::GROUP_USER,
                'is_public' => true,
                'is_locked' => false,
            ],
            [
                'key' => 'user.default_avatar',
                'value' => 'images/default-avatar.png',
                'type' => Setting::TYPE_STRING,
                'group' => Setting::GROUP_USER,
                'is_public' => true,
                'is_locked' => false,
            ],
            [
                'key' => 'user.max_avatar_size',
                'value' => 5120,
                'type' => Setting::TYPE_INTEGER,
                'group' => Setting::GROUP_USER,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'user.allow_profile_edit',
                'value' => true,
                'type' => Setting::TYPE_BOOLEAN,
                'group' => Setting::GROUP_USER,
                'is_public' => true,
                'is_locked' => false,
            ],
            [
                'key' => 'user.allow_delete_account',
                'value' => false,
                'type' => Setting::TYPE_BOOLEAN,
                'group' => Setting::GROUP_USER,
                'is_public' => true,
                'is_locked' => false,
            ],
            [
                'key' => 'user.allow_change_email',
                'value' => true,
                'type' => Setting::TYPE_BOOLEAN,
                'group' => Setting::GROUP_USER,
                'is_public' => true,
                'is_locked' => false,
            ],
            [
                'key' => 'user.allow_change_username',
                'value' => true,
                'type' => Setting::TYPE_BOOLEAN,
                'group' => Setting::GROUP_USER,
                'is_public' => true,
                'is_locked' => false,
            ],

            // SECURITY
            [
                'key' => 'security.enable_api',
                'value' => true,
                'type' => Setting::TYPE_BOOLEAN,
                'group' => Setting::GROUP_SECURITY,
                'is_public' => false,
                'is_locked' => false,
            ],
            [
                'key' => 'security.audit_log',
                'value' => true,
                'type' => Setting::TYPE_BOOLEAN,
                'group' => Setting::GROUP_SECURITY,
                'is_public' => false,
                'is_locked' => false,
            ],
        ];
    }
}
