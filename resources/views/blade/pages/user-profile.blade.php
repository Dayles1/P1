@extends('blade.layouts.authenticated')

@section('title', __('ui.user_profile.title'))

@section('content')

    {{-- =====================================================
         PUBLIC PROFILE
         -----------------------------------------------------
         How someone looks to everyone else (the Profile-Public board):
         a cover tinted with their avatar hue, the avatar overlapping it,
         name, role, position and department, presence, local time and
         how fast they usually answer; "Start chat", "Call" (only with a
         visible phone) and a "more" menu; tabs for the overview, the
         common groups and the shared files; on the right a quick first
         message, contacts and what you have in common. Filled by
         resources/js/blade/app/user-profile.js from /api/users/{id};
         everything taken from chats comes from conversations both of
         you are in.
         ===================================================== --}}
    <div class="user-profile" data-user-profile-page data-user-id="{{ $userId }}">

        <div class="user-profile__cover" data-user-cover aria-hidden="true"></div>

        <div class="user-profile__head">
            <span class="user-profile__avatar-ring">
                <span class="avatar user-profile__avatar" data-user-avatar>
                    <span class="avatar__initials" aria-hidden="true">--</span>
                </span>
            </span>

            <div class="user-profile__who">
                <div class="user-profile__name-row">
                    <h1 class="user-profile__name" data-user-name>
                        <span class="skeleton skeleton--text" aria-hidden="true"></span>
                        <span class="sr-only">{{ __('ui.user_profile.title') }}</span>
                    </h1>
                    <span class="user-profile__badge" data-user-role hidden></span>
                    <span class="badge badge--danger" data-user-banned hidden>{{ __('ui.chat.banned') }}</span>
                    <span class="badge badge--danger" data-user-blocked hidden>{{ __('ui.user_profile.blocked_badge') }}</span>
                </div>
                <span class="user-profile__position" data-user-position></span>
                <span class="user-profile__status" data-user-status></span>
            </div>

            <div class="user-profile__actions" data-user-actions></div>
        </div>

        <div class="user-profile__tabs" role="tablist" aria-label="{{ __('ui.user_profile.title') }}" data-user-tabs>
            @foreach (['overview', 'groups', 'files'] as $tab)
                <button
                    type="button"
                    role="tab"
                    class="user-profile__tab"
                    id="user-tab-{{ $tab }}"
                    aria-controls="user-panel-{{ $tab }}"
                    aria-selected="{{ $tab === 'overview' ? 'true' : 'false' }}"
                    tabindex="{{ $tab === 'overview' ? '0' : '-1' }}"
                    data-user-tab="{{ $tab }}"
                >{{ __("ui.user_profile.tabs.{$tab}", ['count' => 0]) }}</button>
            @endforeach
        </div>

        <div class="user-profile__body">

            <div class="user-profile__main">

                <div class="user-profile__panel" role="tabpanel" id="user-panel-overview" aria-labelledby="user-tab-overview" data-user-panel="overview">
                    <section class="user-profile__section user-profile__section--about" aria-labelledby="user-about-title">
                        <div class="user-profile__section-head">
                            <h2 class="user-profile__section-title" id="user-about-title">{{ __('ui.user_profile.sections.about') }}</h2>
                        </div>
                        <div data-user-about>
                            <x-blade.u-i.skeleton :rows="2" />
                        </div>
                    </section>

                    <section class="user-profile__section user-profile__section--recent" aria-labelledby="user-recent-title">
                        <div class="user-profile__section-head">
                            <h2 class="user-profile__section-title" id="user-recent-title">{{ __('ui.user_profile.sections.recent') }}</h2>
                        </div>
                        <div data-user-recent></div>
                    </section>

                    <section class="user-profile__section user-profile__section--shared" aria-labelledby="user-shared-title">
                        <div class="user-profile__section-head">
                            <h2 class="user-profile__section-title" id="user-shared-title">{{ __('ui.user_profile.sections.shared') }}</h2>
                            <button type="button" class="btn btn--ghost btn--sm" data-user-open-files hidden>{{ __('ui.user_profile.all') }}</button>
                        </div>
                        <div data-user-shared></div>
                    </section>
                </div>

                <div class="user-profile__panel" role="tabpanel" id="user-panel-groups" aria-labelledby="user-tab-groups" data-user-panel="groups" hidden>
                    <div data-user-groups></div>
                </div>

                <div class="user-profile__panel" role="tabpanel" id="user-panel-files" aria-labelledby="user-tab-files" data-user-panel="files" hidden>
                    <div class="user-profile__kinds" role="group" data-user-kinds>
                        @foreach (['media', 'files', 'voice', 'links'] as $kind)
                            <button type="button" class="user-profile__kind" aria-pressed="{{ $kind === 'media' ? 'true' : 'false' }}" data-user-kind="{{ $kind }}">{{ __("ui.user_profile.files.{$kind}") }}</button>
                        @endforeach
                    </div>
                    <div data-user-files></div>
                </div>

            </div>

            <aside class="user-profile__side">
                <section class="user-profile__write" aria-labelledby="user-write-title" data-user-write hidden>
                    <h2 class="user-profile__write-title" id="user-write-title" data-user-write-title></h2>
                    <form class="user-profile__write-form" data-user-write-form>
                        <textarea
                            class="user-profile__write-input"
                            rows="1"
                            maxlength="5000"
                            placeholder="{{ __('ui.user_profile.write.placeholder') }}"
                            aria-label="{{ __('ui.user_profile.write.label') }}"
                            data-user-write-input
                        ></textarea>
                        <div class="user-profile__chips">
                            @foreach (['quick_hello', 'quick_minute', 'quick_call'] as $chip)
                                <button type="button" class="user-profile__chip" data-user-chip>{{ __("ui.user_profile.write.{$chip}") }}</button>
                            @endforeach
                        </div>
                        <button type="submit" class="btn btn--primary btn--block" data-user-write-submit>
                            <x-blade.u-i.icon name="chat" size="15" />
                            {{ __('ui.user_profile.start_chat') }}
                        </button>
                    </form>
                </section>

                <section class="user-profile__section user-profile__section--contacts" aria-labelledby="user-contacts-title">
                    <div class="user-profile__section-head">
                        <h2 class="user-profile__section-title" id="user-contacts-title">{{ __('ui.user_profile.sections.contacts') }}</h2>
                    </div>
                    <dl class="user-profile__facts">
                        @foreach (['email', 'telegram', 'phone', 'department', 'language', 'joined'] as $fact)
                            <div class="user-profile__fact" data-user-fact-row="{{ $fact }}">
                                <dt>{{ __("ui.user_profile.contact.{$fact}") }}</dt>
                                <dd data-user-fact="{{ $fact }}">—</dd>
                            </div>
                        @endforeach
                    </dl>
                </section>

                <section class="user-profile__section user-profile__section--common" aria-labelledby="user-common-title">
                    <div class="user-profile__section-head">
                        <h2 class="user-profile__section-title" id="user-common-title" data-user-common-title>{{ __('ui.user_profile.sections.common') }}</h2>
                    </div>
                    <div data-user-common>
                        <x-blade.u-i.skeleton :rows="2" />
                    </div>
                </section>
            </aside>

        </div>

    </div>

@endsection

@push('scripts')
    @vite('resources/js/blade/app/user-profile.js')
@endpush
