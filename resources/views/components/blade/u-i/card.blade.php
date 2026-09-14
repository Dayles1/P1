<div {{ $attributes->class(['card']) }}>

    @if ($title || $subtitle || isset($actions))
        <div class="card__header">
            <div>
                @if ($title)
                    <h2 class="card__title">{{ $title }}</h2>
                @endif

                @if ($subtitle)
                    <p class="card__subtitle">{{ $subtitle }}</p>
                @endif
            </div>

            @isset($actions)
                <div>{{ $actions }}</div>
            @endisset
        </div>
    @endif

    <div @class(['card__body', 'card__body--flush' => $flush])>
        {{ $slot }}
    </div>

    @isset($footer)
        <div class="card__footer">{{ $footer }}</div>
    @endisset

</div>
