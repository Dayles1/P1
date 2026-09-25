# Экраны → маршруты → Blade

Размеры в имени: без суффикса = десктоп 1440, `-2K` = 2560, `-4K` = 3840 (масштаб 150%), `-1024`, `-Phone` = 390.

## Каркас и общие элементы
| Экран | Что это |
|---|---|
| Work-Home-2K / -4K / -1024 / -Phone | Каркас: сайдбар, шапка, нижняя панель на телефоне |
| Account-Menu | Меню под аватаром (тема, язык, выход) |
| Notif-Popover | Выпадающие уведомления под колокольчиком |
| Command-Palette | Поиск и команды, Ctrl K |
| Offline | Плашка «нет соединения», неотправленное сообщение |

## Приложение
| Маршрут | Blade | Экраны |
|---|---|---|
| /dashboard | pages/dashboard | Work-Home-2K, -4K, -1024, -Phone |
| /profile (новое, вместо редиректа) | pages/profile | Work-Profile-2K, -4K, -1024, -Phone |
| /users/{id} (новое) | pages/users/show | Profile-Other, Profile-Other-Phone |
| /chat, /chat/{conversation} | pages/chat | Work-Chat-2K, -4K, -1024, -Phone, Chat-Phone-Dialog, Chat-Empty, Chat-New, Chat-New-Phone |
| /notifications | pages/notifications | Notifications-Desktop, Notifications-1024, Notifications-Phone |

## Мой аккаунт (заменяет /settings/* и /sessions)
| Маршрут | Экраны |
|---|---|
| /settings/profile | Account-Desktop, Account-1024, Account-Phone (хаб на телефоне) |
| /settings/security | Account-Security, Phone-Security |
| /sessions | Account-Sessions, Phone-Sessions |
| /sessions/{session} | Session-Detail |
| /settings/notifications | Account-Notifications, Phone-NotifSettings |
| /settings/appearance + /settings/language | Account-Appearance, Phone-Appearance |
| /settings/developer | Account-Developers |
| /changelog | Account-Changelog |

## Администрирование
| Маршрут | Экраны |
|---|---|
| /admin/users | Admin-Users, Admin-Users-1024, Admin-Users-Phone, Admin-Invite, Admin-Empty |
| /admin/users/{id} (новое) | Admin-User-Detail, Admin-Ban |
| /admin/sessions, /admin/sessions/{id} | Admin-Sessions, Session-Detail |
| /admin/request-logs | Admin-Logs |
| /admin/settings | Admin-Settings |
| /admin/settings/general | Admin-General |
| /admin/settings/authentication | Admin-Auth |
| /admin/settings/localization | Admin-Localization |
| /admin/settings/notifications | Admin-Notifications |
| /admin/settings/security | Admin-Security |
| /admin/settings/system | Admin-System |
| /admin/currencies (новое) | Admin-Currencies, Admin-Currency-Edit, Admin-Currency-History, Currencies-1024, Currencies-Phone |
| /admin/prices (новое) | Admin-Prices, Admin-Price-Edit, Admin-Empty (пустое) |
| /admin/organizations (новое) | Admin-Organizations, Admin-Dept-Edit |

## Публичные и вход
| Маршрут | Экраны |
|---|---|
| / | Public-Home, Public-Home-1024, Public-Home-Phone |
| /about | Public-About, Public-About-Phone |
| /contact | Public-Contact, Public-Contact-Phone |
| /terms, /privacy (новое) | Public-Legal |
| /login | Login-Desktop, Login-1024, Login-Phone |
| /login/code | Auth-Code, Auth-Code-Phone |
| /register | Auth-Register, Auth-Register-Phone |
| /forgot-password | Auth-Forgot |
| /reset-password/{token} | Auth-Reset |
| /verify-email | Auth-Verify |
| /confirm-password | Auth-Confirm |
| онбординг после регистрации (новое) | Onboarding, Onboarding-Phone, Onboarding-Done |
| errors/{403,404,419,429,500,503} | Error-403 … Error-503, Error-404-Phone, Error-500-Phone |

## Письма (resources/views/mail/*)
Email-Code, Email-Verify, Email-Reset, Email-NewLogin. Для писем — табличная вёрстка и инлайн-стили, это исключение из правила.

## Справочные доски
Design-System, UI-Inputs-Text, UI-Inputs-Choice, UI-Inputs-DateFile, UI-Overlays, UI-Navigation.
