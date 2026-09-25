{{--
    Overlapping stack of avatars with a "+N" tail past `max`.

    <x-blade.u-i.avatar-group :people="$members->map(fn ($m) => ['name' => $m->name, 'src' => $m->avatar?->url])" :max="3" />
--}}
@props(['people' => [], 'max' => 3, 'size' => 'sm'])

@php
    $people = collect($people);
    $shown = $people->take($max);
    $rest = $people->count() - $shown->count();
@endphp

<span {{ $attributes->class(['avatar-group']) }}>
    @foreach ($shown as $person)
        <x-blade.u-i.avatar :name="$person['name'] ?? ''" :src="$person['src'] ?? null" :size="$size" />
    @endforeach

    @if ($rest > 0)
        <span class="avatar avatar--{{ $size }} avatar-group__more">+{{ $rest }}</span>
    @endif
</span>
