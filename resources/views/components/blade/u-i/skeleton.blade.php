{{--
    Loading placeholders.
    <x-blade.u-i.skeleton type="list" :rows="3" />   avatar + two lines per row
    <x-blade.u-i.skeleton type="card" />             a stat card
    <x-blade.u-i.skeleton type="text" />             a short inline line
    <x-blade.u-i.skeleton :rows="4" />               plain rows
--}}
@props(['type' => 'rows', 'rows' => 3])

@if ($type === 'list')
    <div {{ $attributes->class(['skeleton-list']) }} aria-hidden="true">
        @for ($i = 0; $i < $rows; $i++)
            <div class="skeleton-list__row">
                <span class="skeleton skeleton--circle"></span>
                <span class="skeleton-list__lines">
                    <span class="skeleton skeleton--line"></span>
                    <span class="skeleton skeleton--line-sm"></span>
                </span>
            </div>
        @endfor
    </div>
@elseif ($type === 'card' || $type === 'text')
    <span {{ $attributes->class(['skeleton', "skeleton--{$type}"]) }} aria-hidden="true"></span>
@else
    <div {{ $attributes }} aria-hidden="true">
        @for ($i = 0; $i < $rows; $i++)
            <div class="skeleton skeleton-row"></div>
        @endfor
    </div>
@endif
