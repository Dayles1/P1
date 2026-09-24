{{--
    Underline tabs. Each tab: ['id' => …, 'label' => …, 'count' => ?, 'href' => ?].
    With `href` the tabs are links to their own routes (the selected one is
    the current page); without, they switch panels in place — give each
    panel id="{tabs-id}-{tab-id}" and shared/form-controls.js shows the
    selected one and fires `tabs:change`.

    <x-blade.u-i.tabs id="account" :tabs="$tabs" selected="sessions" :label="…" />
--}}
@props(['tabs' => [], 'selected' => null, 'label' => null, 'id' => 'tabs'])

<div {{ $attributes->class(['tabs']) }} role="tablist" data-tabs @if ($label) aria-label="{{ $label }}" @endif>
    @foreach ($tabs as $tab)
        @php($isSelected = (string) $tab['id'] === (string) $selected)

        @if (! empty($tab['href']))
            <a
                href="{{ $tab['href'] }}"
                class="tabs__tab"
                role="tab"
                aria-selected="{{ $isSelected ? 'true' : 'false' }}"
                @if ($isSelected) aria-current="page" @endif
                tabindex="{{ $isSelected ? 0 : -1 }}"
            >
        @else
            <button
                type="button"
                class="tabs__tab"
                role="tab"
                id="{{ $id }}-tab-{{ $tab['id'] }}"
                aria-controls="{{ $id }}-{{ $tab['id'] }}"
                aria-selected="{{ $isSelected ? 'true' : 'false' }}"
                data-value="{{ $tab['id'] }}"
                tabindex="{{ $isSelected ? 0 : -1 }}"
            >
        @endif
            {{ $tab['label'] }}
            @isset($tab['count'])
                <span class="badge">{{ $tab['count'] }}</span>
            @endisset
        @if (! empty($tab['href']))
            </a>
        @else
            </button>
        @endif
    @endforeach
</div>
