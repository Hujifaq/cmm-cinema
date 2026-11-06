using Microsoft.Extensions.Options;
using Resend;

namespace CMM_Cinema.Services;

// Bound from the "Resend" configuration section; keep it in user-secrets.
public sealed class ResendOptions
{
    public string ApiKey { get; set; } = "";
    public string FromAddress { get; set; } = "";
}

public sealed class ResendEmailSender(IResend resend, IOptions<ResendOptions> options, ILogger<ResendEmailSender> logger) : IEmailSender
{
    public async Task<bool> SendAsync(string to, EmailContent content, CancellationToken cancellationToken = default)
    {
        var message = new EmailMessage
        {
            From = options.Value.FromAddress,
            Subject = content.Subject,
            HtmlBody = content.HtmlBody,
            TextBody = content.TextBody
        };
        message.To.Add(to);

        try
        {
            var response = await resend.EmailSendAsync(message, cancellationToken);
            if (response.Success) return true;
            logger.LogWarning("Email to {Recipient} failed: {Error}", Mask(to), response.Exception?.Message);
        }
        catch (ResendException ex)
        {
            // Without a verified domain Resend answers 403 for any recipient except the account owner.
            logger.LogWarning("Email to {Recipient} failed ({Status} {ErrorType}): {Error}", Mask(to), ex.StatusCode, ex.ErrorType, ex.Message);
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "Email to {Recipient} failed: Resend unreachable", Mask(to));
        }
        return false;
    }

  
    private static string Mask(string email)
    {
        var at = email.IndexOf('@');
        return at <= 0 ? "***" : email[..Math.Min(2, at)] + "***" + email[at..];
    }
}
