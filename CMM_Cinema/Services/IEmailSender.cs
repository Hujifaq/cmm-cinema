namespace CMM_Cinema.Services;

public sealed record EmailContent(string Subject, string HtmlBody, string TextBody);

public interface IEmailSender
{
    // Returns false instead of throwing, so a mail outage never reveals whether an account exists.
    Task<bool> SendAsync(string to, EmailContent content, CancellationToken cancellationToken = default);
}
