{{--
    A one-of-few choice drawn as a segmented bar — real radios, so it posts
    and works with the keyboard like any radio group.

    <x-blade.u-i.segmented name="period" :options="['day' => …, 'week' => …]" selected="week" :label="…" />
--}}
@props(['name', 'options' => [], 'selected' => null, 'label' => null, 'inline' => false])

<div {{ $attributes->class(['segmented', 'segmented--inline' => $inline]) }} role="radiogroup" @if ($label) aria-label="{{ $label }}" @endif>
    @foreach ($options as $value => $optionLabel)
        <label class="segmented__option">
            <input type="radio" class="sr-only" name="{{ $name }}" value="{{ $value }}" @checked((string) $value === (string) $selected)>
            {{ $optionLabel }}
        </label>
    @endforeach
</div>
