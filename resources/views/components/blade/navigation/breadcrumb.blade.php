@if (count($items))
    <nav {{ $attributes->class(['breadcrumb']) }} aria-label="{{ __('ui.components.breadcrumbs') }}">
        <ol class="breadcrumb__list">
            @foreach ($items as $index => $item)
                @php
                    $isLast = $index === array_key_last($items);
                @endphp

                <li class="breadcrumb__item">
                    @if (!empty($item['url']) && !$isLast)
                        <a href="{{ $item['url'] }}" class="breadcrumb__link">
                            {{ $item['label'] }}
                        </a>
                    @else
                        <span class="breadcrumb__current" @if ($isLast) aria-current="page" @endif>
                            {{ $item['label'] }}
                        </span>
                    @endif

                    @unless ($isLast)
                        <span class="breadcrumb__separator" aria-hidden="true"><x-blade.u-i.icon name="chev" size="14" /></span>
                    @endunless
                </li>
            @endforeach
        </ol>
    </nav>
@endif
