import { api } from '../axios';
import { initials } from '../shared/auth-state';
import { showToast, apiErrorMessage } from '../shared/toast';
import { apiErrors, clearFieldErrors, showFieldErrors } from '../shared/forms';
import { t } from '../shared/i18n';

let currentUser = null;

/*
|--------------------------------------------------------------------------
| DOM
|--------------------------------------------------------------------------
*/

const avatarEl = document.querySelector('[data-profile-avatar]');
const avatarInitialsEl = document.querySelector('[data-profile-avatar-initials]');
const avatarInput = document.querySelector('[data-avatar-input]');
const avatarTrigger = document.querySelector('[data-avatar-trigger]');

const profileForm = document.querySelector('[data-profile-form]');
const passwordForm = document.querySelector('[data-password-form]');
const currentPasswordField = document.querySelector('[data-current-password-field]');

const banNotice = document.querySelector('[data-ban-notice]');
const banNoticeText = document.querySelector('[data-ban-notice-text]');

const rolesEl = document.querySelector('[data-profile-roles]');

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function renderAvatar(user) {
    if (user.avatar?.url) {
        avatarEl.innerHTML = `<img class="avatar__image" src="${user.avatar.url}" alt="${user.name}">`;
    } else if (avatarInitialsEl) {
        avatarInitialsEl.textContent = initials(user.name);
    }
}

function renderRoles(user) {
    if (!rolesEl) {
        return;
    }

    if (!user.roles?.length) {
        rolesEl.innerHTML = `<span class="field-hint">${t('profile.no_roles')}</span>`;

        return;
    }

    rolesEl.innerHTML = user.roles
        .map((role) => `<span class="pill pill--primary" style="margin-right:6px;">${role.name}</span>`)
        .join('');
}

function renderBan(user) {
    if (!banNotice) {
        return;
    }

    if (user.ban?.is_active) {
        banNotice.hidden = false;

        let message = user.ban.reason
            ? t('profile.banned_notice_reason', { reason: user.ban.reason })
            : t('profile.banned_notice');

        if (user.ban.ends_at) {
            message += t('profile.banned_notice_until', { date: user.ban.ends_at });
        }

        banNoticeText.textContent = message;
    } else {
        banNotice.hidden = true;
    }
}

/*
|--------------------------------------------------------------------------
| Load profile
|--------------------------------------------------------------------------
*/

async function loadProfile() {
    try {
        const { data } = await api.get('/profile');

        currentUser = data.data;

        profileForm.querySelector('[name="name"]').value = currentUser.name;
        profileForm.querySelector('[name="email"]').value = currentUser.email;

        renderAvatar(currentUser);
        renderRoles(currentUser);
        renderBan(currentUser);
    } catch (error) {
        showToast(apiErrorMessage(error, t('profile.load_error')), 'error');
    }
}

/*
|--------------------------------------------------------------------------
| Toggle current_password requirement when email changes
|--------------------------------------------------------------------------
*/

profileForm?.querySelector('[name="email"]')?.addEventListener('input', (event) => {
    const changed = currentUser && event.target.value !== currentUser.email;

    currentPasswordField.hidden = !changed;
});

/*
|--------------------------------------------------------------------------
| Profile form
|--------------------------------------------------------------------------
*/

profileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    clearFieldErrors(profileForm);

    const formData = new FormData(profileForm);
    const payload = Object.fromEntries(formData.entries());

    if (!payload.current_password) {
        delete payload.current_password;
    }

    const submitButton = profileForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        const { data } = await api.patch('/profile', payload);

        currentUser = data.data;

        renderRoles(currentUser);
        renderBan(currentUser);

        currentPasswordField.hidden = true;
        profileForm.querySelector('[name="current_password"]').value = '';

        showToast(t('profile.updated'));
    } catch (error) {
        showFieldErrors(profileForm, apiErrors(error));
        showToast(apiErrorMessage(error, t('profile.save_error')), 'error');
    } finally {
        submitButton.disabled = false;
    }
});

/*
|--------------------------------------------------------------------------
| Password form
|--------------------------------------------------------------------------
*/

passwordForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    clearFieldErrors(passwordForm);

    const formData = new FormData(passwordForm);
    const payload = Object.fromEntries(formData.entries());

    const submitButton = passwordForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        await api.patch('/profile', payload);

        passwordForm.reset();

        showToast(t('profile.password_updated'));
    } catch (error) {
        showFieldErrors(passwordForm, apiErrors(error));
        showToast(apiErrorMessage(error, t('profile.password_error')), 'error');
    } finally {
        submitButton.disabled = false;
    }
});

/*
|--------------------------------------------------------------------------
| Avatar upload
|--------------------------------------------------------------------------
*/

avatarTrigger?.addEventListener('click', () => {
    avatarInput?.click();
});

avatarInput?.addEventListener('change', async () => {
    const file = avatarInput.files?.[0];

    if (!file) {
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    avatarTrigger.disabled = true;

    try {
        const { data } = await api.post('/profile/avatars', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (data.data?.url) {
            avatarEl.innerHTML = `<img class="avatar__image" src="${data.data.url}" alt="avatar">`;
        }

        showToast(t('profile.avatar_updated'));
    } catch (error) {
        showToast(apiErrorMessage(error, t('profile.avatar_error')), 'error');
    } finally {
        avatarTrigger.disabled = false;
        avatarInput.value = '';
    }
});

loadProfile();
