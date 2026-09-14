{{-- =====================================================
     FLASH NOTIFICATIONS
     ===================================================== --}}

@if (session('status'))
    <x-blade.feedback.alert type="success">
        {{ session('status') }}
    </x-blade.feedback.alert>
@endif

@if (session('error'))
    <x-blade.feedback.alert type="error">
        {{ session('error') }}
    </x-blade.feedback.alert>
@endif

@if ($errors->any())
    <x-blade.feedback.alert type="error">
        <strong>Please check the following:</strong>
        <ul>
            @foreach ($errors->all() as $error)
                <li>{{ $error }}</li>
            @endforeach
        </ul>
    </x-blade.feedback.alert>
@endif


{{-- Toasts pushed dynamically from JS land here --}}
<div class="toast-stack" id="toast-stack" data-toast-stack aria-live="polite"></div>
