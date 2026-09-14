<?php

return [

    'not_found' => 'The requested resource was not found.',

    'auth' => [
        'login_success' => 'Welcome back! You are now signed in.',
        'register_success' => 'Your account has been created.',
        'logout_success' => 'You have been signed out.',
        'me_success' => 'Current user retrieved.',
        'password_reset_link_sent' => 'If that email exists, a password reset link has been sent.',
        'password_reset_success' => 'Your password has been reset. You can now sign in.',
        'verification_link_sent' => 'A verification link has been sent to your email.',
        'email_already_verified' => 'This email address is already verified.',
        'email_not_found' => 'We could not find an account with that email address.',
        'invalid_password' => 'The password you entered is incorrect.',
        'password_confirmed' => 'Your password has been confirmed.',
    ],

    'profile' => [
        'updated' => 'Your profile has been updated.',
        'avatar_uploaded' => 'Your avatar has been uploaded.',
        'avatar_deleted' => 'Your avatar has been removed.',
        'avatar_upload_disabled' => 'Avatar uploads are currently disabled.',
    ],

    'session' => [
        'revoked' => 'The session has been signed out.',
        'others_revoked' => 'All other sessions have been signed out.',
        'no_other_sessions' => 'There were no other active sessions to sign out.',
    ],

    'settings' => [
        'updated' => 'Setting updated.',
        'locked' => 'This setting is locked and cannot be changed.',
    ],

    'chat' => [
        'list' => 'Conversations retrieved.',
        'members_listed' => 'Members retrieved.',
        'updated' => 'Conversation updated.',
        'deleted' => 'Conversation deleted.',
        'pinned' => 'Conversation pinned.',
        'unpinned' => 'Conversation unpinned.',
        'members_added' => 'Members added to the conversation.',
        'members_removed' => 'Members removed from the conversation.',
        'message_sent' => 'Message sent.',
        'not_a_member' => 'You are not a member of this conversation.',
        'not_allowed' => 'You are not allowed to perform this action.',
        'cannot_update_private_chat' => 'A private conversation cannot be renamed.',
        'cannot_add_member_to_private_chat' => 'You cannot add members to a private conversation.',
        'cannot_remove_member_from_private_chat' => 'You cannot remove members from a private conversation.',
        'max_pinned_reached' => 'You have reached the maximum number of pinned conversations.',
    ],

    'admin' => [
        'role_updated' => "The user's role has been updated.",
        'role_not_found' => 'That role does not exist.',
        'user_banned' => 'The user has been banned.',
        'user_unbanned' => 'The user has been unbanned.',
        'superadmin_protected' => 'Only a super admin can modify another super admin.',
    ],

];
