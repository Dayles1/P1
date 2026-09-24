{{--
    Question/answer rows on native <details> — keyboard and screen
    readers work with no script. Items: ['title' => …, 'body' => …, 'open' => ?].

    <x-blade.u-i.accordion :items="$faq" />
--}}
@props(['items' => []])

<div {{ $attributes->class(['accordion']) }}>
    @foreach ($items as $item)
        <details class="accordion__item" @if (! empty($item['open'])) open @endif>
            <summary class="accordion__summary">
                {{ $item['title'] }}
                <x-blade.u-i.icon name="chevdown" size="18" class="accordion__chevron" />
            </summary>
            <div class="accordion__body">{{ $item['body'] }}</div>
        </details>
    @endforeach
</div>
