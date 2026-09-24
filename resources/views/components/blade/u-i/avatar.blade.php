{{--
    <x-blade.u-i.avatar name="Alisher Karimov" />
    <x-blade.u-i.avatar :name="$user->name" :src="$user->avatar?->url" size="lg" status="online" />
--}}
<span
    {{ $attributes->class([
        'avatar',
        "avatar--{$size}",
        "avatar--hue-{$hue}" => ! $src,
    ]) }}
>
    @if ($src)
        <img src="{{ $src }}" alt="" class="avatar__image">
    @else
        <span class="avatar__initials" aria-hidden="true">{{ $initials }}</span>
    @endif

    <span class="sr-only">{{ $name }}</span>

    @if ($status)
        <span class="avatar__status avatar__status--{{ $status }}" aria-hidden="true"></span>
    @endif
</span>
