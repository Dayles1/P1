{{--
    Progress through a multi-step flow (onboarding, invites).
    `current` is the 0-based index of the active step.

    <x-blade.u-i.stepper :steps="[__('…account'), __('…profile'), __('…organization'), __('…done')]" :current="2" />
--}}
@props(['steps' => [], 'current' => 0])

<ol {{ $attributes->class(['stepper']) }}>
    @foreach ($steps as $index => $step)
        @if ($index > 0)
            <li class="stepper__line" aria-hidden="true"></li>
        @endif

        <li
            @class([
                'stepper__step',
                'stepper__step--done' => $index < $current,
                'stepper__step--current' => $index === $current,
            ])
            @if ($index === $current) aria-current="step" @endif
        >
            <span class="stepper__marker">
                @if ($index < $current)
                    <x-blade.u-i.icon name="check" size="16" />
                @else
                    {{ $index + 1 }}
                @endif
            </span>
            <span class="stepper__label">{{ $step }}</span>
        </li>
    @endforeach
</ol>
