{{-- =====================================================
     I18N BOOTSTRAP
     -----------------------------------------------------
     One source of truth for UI strings: `lang/{locale}/ui.php`.
     Blade uses it directly via __('ui.xxx'); this exposes the SAME
     dictionary to JS as window.__i18n so table headers, toasts, and
     other client-rendered text can call t('xxx') for the exact same
     keys instead of hardcoding a second copy of every string.
     ===================================================== --}}
<script>
    window.__i18n = {
        locale: @json(app()->getLocale()),
        strings: @json(trans('ui')),
    };
</script>
