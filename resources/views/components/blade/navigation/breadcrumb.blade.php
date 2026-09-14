@if (count($items))
    <nav class="breadcrumb" aria-label="Breadcrumb" {{ $attributes }}>
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
                        <span class="breadcrumb__separator" aria-hidden="true">/</span>
                    @endunless
                </li>
            @endforeach
        </ol>
    </nav>
@endif
