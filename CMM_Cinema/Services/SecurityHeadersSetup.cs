namespace CMM_Cinema.Services;

public static class SecurityHeadersSetup
{
    public static HeaderPolicyCollection Policies() => new HeaderPolicyCollection()
        .AddFrameOptionsDeny()
        .AddContentTypeOptionsNoSniff()
        .AddReferrerPolicyStrictOriginWhenCrossOrigin()
        .AddCrossOriginOpenerPolicy(builder => builder.SameOrigin())
        .AddPermissionsPolicy(builder =>
        {
            builder.AddCamera().None();
            builder.AddMicrophone().None();
            builder.AddGeolocation().None();
            builder.AddPayment().None();
            builder.AddUsb().None();
        })
        .RemoveServerHeader()
        .AddContentSecurityPolicy(builder =>
        {
            builder.AddDefaultSrc().Self();
            builder.AddScriptSrc().Self().From("https://challenges.cloudflare.com").WithNonce();
            builder.AddStyleSrc().Self().WithNonce();
            builder.AddStyleSrcAttr().UnsafeInline();
            builder.AddImgSrc().Self().From("https:").Data();
            builder.AddFontSrc().Self();
            builder.AddConnectSrc().Self();
            builder.AddFrameSrc()
                .From("https://challenges.cloudflare.com")
                .From("https://www.youtube-nocookie.com")
                .From("https://player.vimeo.com");
            builder.AddFormAction().Self().From("https://accounts.google.com");
            builder.AddFrameAncestors().None();
            builder.AddBaseUri().Self();
            builder.AddObjectSrc().None();
        });
}
