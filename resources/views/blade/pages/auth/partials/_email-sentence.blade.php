{{--
    A translated sentence with the address in bold where its `:email`
    placeholder sits (word order differs between languages, so the
    sentence is never split in two). The bold part is
    [data-auth-email]: auth-pages.js writes the address the visitor just
    typed into it. Pass $key (the translation key) and, when the server
    already knows it, $email.
--}}
{!! str_replace(
    ':email',
    '<strong class="auth-card__email" data-auth-email>'.e($email ?? '').'</strong>',
    e(__($key)),
) !!}
