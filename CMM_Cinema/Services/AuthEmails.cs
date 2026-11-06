using System.Net;

namespace CMM_Cinema.Services;

public static class AuthEmails
{
    public static EmailContent VerifyEmail(string name, string link) => Build(
        "Confirm your CMM Cinema email",
        $"Hi {name},",
        "Confirm your email to finish creating your CMM Cinema account. This link expires in 24 hours.",
        ("Confirm email", link),
        "If you didn't create an account, you can ignore this email.");

    public static EmailContent ResetPassword(string name, string link) => Build(
        "Reset your CMM Cinema password",
        $"Hi {name},",
        "We got a request to reset your password. This link expires in 30 minutes and works once.",
        ("Reset password", link),
        "If you didn't ask for this, ignore this email. Your password won't change.");

    public static EmailContent GoogleOnlyAccount(string name, string loginLink) => Build(
        "Signing in to CMM Cinema",
        $"Hi {name},",
        "Someone asked to reset the password for this email, but your account signs in with Google and has no password.",
        ("Sign in with Google", loginLink),
        "If this wasn't you, you don't need to do anything.");

    public static EmailContent PasswordChanged(string name, string resetLink) => Build(
        "Your CMM Cinema password was changed",
        $"Hi {name},",
        "Your password was just changed and every other session was signed out.",
        ("This wasn't me", resetLink),
        "If you made this change, you don't need to do anything.");

    public static EmailContent SignUpAttempt(string name, string loginLink) => Build(
        "Someone tried to sign up with your email",
        $"Hi {name},",
        "Someone tried to create a CMM Cinema account with this email, but you already have one.",
        ("Go to sign in", loginLink),
        "If this was you, sign in or reset your password instead. If not, you can ignore this email.");

    private static EmailContent Build(string subject, string greeting, string body, (string Label, string Url) button, string footer)
    {
        // Names come from users; encoding stops <script> or fake links in a name from becoming HTML.
        var html = $"""
            <!DOCTYPE html>
            <html>
            <body style="margin:0;padding:0;background:#103d3e;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#103d3e;padding:32px 16px;">
                <tr><td align="center">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fffdf5;border-radius:24px;">
                    <tr><td style="padding:36px 32px;font-family:Helvetica,Arial,sans-serif;color:#071c1e;">
                      <p style="margin:0 0 24px;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">CMM Cinema</p>
                      <p style="margin:0 0 12px;font-size:20px;font-weight:700;">{WebUtility.HtmlEncode(greeting)}</p>
                      <p style="margin:0 0 28px;font-size:15px;line-height:1.6;">{WebUtility.HtmlEncode(body)}</p>
                      <a href="{WebUtility.HtmlEncode(button.Url)}" style="display:inline-block;padding:14px 28px;background:#071c1e;color:#fffde6;border-radius:999px;font-size:15px;font-weight:700;text-decoration:none;">{WebUtility.HtmlEncode(button.Label)}</a>
                      <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:rgba(7,28,30,.6);">{WebUtility.HtmlEncode(footer)}</p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """;

        var text = $"{greeting}\n\n{body}\n\n{button.Label}: {button.Url}\n\n{footer}\n\nCMM Cinema";
        return new EmailContent(subject, html, text);
    }
}
