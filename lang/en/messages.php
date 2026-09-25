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
        'verification_required' => 'Enter the verification code we sent to your email.',
        'code_sent' => 'If that email exists, a sign-in code has been sent.',
        'email_verified' => 'Your email has been verified.',
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
        'favicon_updated' => 'Favicon updated.',
        'favicon_removed' => 'Favicon reset to the default.',
    ],

    'currency' => [
        'no_rate' => 'No exchange rate is available to convert :from to :to.',
    ],

    'payment' => [
        'created' => 'Payment created.',
        'not_pending' => 'Payment :payment can no longer be paid.',
        'invalid_amount' => 'The amount must be greater than zero.',
        'unsupported_provider' => 'Payments through :provider are not available.',
        'unsupported_currency' => ':provider does not accept payments in :currency.',
        'card_unusable' => 'This card cannot be used for this payment.',
        'wallet_cannot_pay_itself' => 'A wallet cannot be topped up from its own balance.',
        'provider_failed' => 'The payment provider is not responding. Please try again later.',
        'provider_rejected' => 'The payment provider declined the request.',
        'card_code_sent' => 'Enter the code sent to the phone linked to your card.',
        'card_verified' => 'Card saved.',
        'card_removed' => 'Card removed.',
    ],

    'wallet' => [
        'insufficient_funds' => 'There is not enough money in your wallet.',
        'top_up_description' => 'Wallet top-up',
    ],
    'notifications' => [
        'marked_read' => 'Notification marked as read.',
        'all_marked_read' => 'All notifications marked as read.',
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
        'message_updated' => 'Message updated.',
        'message_deleted' => 'Message deleted.',
        'message_read' => 'Message marked as read.',
        'message_pinned' => 'Message pinned.',
        'message_unpinned' => 'Message unpinned.',
        'cannot_edit' => 'You cannot edit this message.',
        'cannot_delete' => 'You cannot delete this message.',
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
