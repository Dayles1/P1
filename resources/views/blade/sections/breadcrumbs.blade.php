{{-- =====================================================
     BREADCRUMBS
     ===================================================== --}}

@if (!empty($breadcrumbs))
    <x-blade.navigation.breadcrumb :items="$breadcrumbs" />
@endif
