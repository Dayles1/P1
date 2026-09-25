{{-- =====================================================
     ICON SPRITE — every <x-blade.u-i.icon> and JS icon() points at a
     <symbol> in here via <use href="#i-…">. Inlined once per page, right
     after <body>, so icons need no extra request and inherit currentColor.
     ===================================================== --}}
{!! file_get_contents(resource_path('svg/icons.svg')) !!}
