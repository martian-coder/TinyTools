package com.perch.guardian;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Hand-port of src/detection/engine.ts — keep the two in sync.
 *
 * Runs entirely on-device inside the NotificationListenerService, so
 * scanning works even when the Perch webview has never been opened.
 * severity "alert" → parent pinged immediately; "watch" → daily digest.
 */
final class Detection {

  static final class Hit {
    final String category;
    final String severity;
    final String reason;
    Hit(String category, String severity, String reason) {
      this.category = category;
      this.severity = severity;
      this.reason = reason;
    }
  }

  private static final class Group {
    final String category;
    final String severity;
    final String reason;
    final List<Pattern> patterns;
    Group(String category, String severity, String reason, String... regexes) {
      this.category = category;
      this.severity = severity;
      this.reason = reason;
      Pattern[] ps = new Pattern[regexes.length];
      for (int i = 0; i < regexes.length; i++) {
        ps[i] = Pattern.compile(regexes[i], Pattern.CASE_INSENSITIVE);
      }
      this.patterns = Arrays.asList(ps);
    }
  }

  private static final List<Group> GROUPS = Arrays.asList(
    new Group("grooming", "alert",
      "secrecy pressure — asking to hide this conversation from parents or adults",
      "\\bdon'?t\\s+tell\\s+(?:your\\s+)?(?:parents?|mom|mum|dad|anyone|adults?|teachers?)\\b",
      "\\bour\\s+(?:little\\s+)?secret\\b",
      "\\bkeep\\s+(?:this|it)\\s+between\\s+us\\b",
      "\\bdelete\\s+(?:this|these|our)\\s+(?:message|chat|conversation)s?\\b",
      "\\bdo\\s+your\\s+parents?\\s+(?:check|see|read|look\\s+at)\\b",
      "\\bare\\s+you\\s+alone\\b",
      "\\bare\\s+your\\s+parents?\\s+(?:home|around|there)\\b",
      "\\bnobody\\s+(?:has\\s+to|needs?\\s+to|will)\\s+know\\b"),
    new Group("photo-request", "alert",
      "requesting photos or camera access",
      "\\bsend\\s+(?:me\\s+)?(?:a\\s+)?(?:photo|pic|picture|selfie|snap)s?\\s*(?:of\\s+(?:you|yourself|ur?self))?\\b",
      "\\bwhat\\s+are\\s+you\\s+wearing\\b",
      "\\bturn\\s+on\\s+(?:your\\s+)?(?:camera|cam|video)\\b",
      "\\bshow\\s+me\\s+(?:your|ur)\\b",
      "\\b(?:nudes?|n4n)\\b"),
    new Group("meetup", "alert",
      "pressure to meet in person or accept a ride",
      "\\bmeet\\s+(?:me|up)\\b.{0,30}\\b(?:alone|secret|don'?t\\s+tell)\\b",
      "\\bi(?:\\s+can|\\s+will|'ll)\\s+pick\\s+you\\s+up\\b",
      "\\bdon'?t\\s+bring\\s+(?:anyone|your\\s+friends?)\\b",
      "\\bcome\\s+(?:to\\s+my|over\\s+to\\s+my)\\s+(?:place|house|apartment|hotel)\\b",
      "\\bget\\s+in\\s+(?:my|the)\\s+car\\b"),
    new Group("explicit", "alert",
      "sexually explicit content sent to this phone",
      "\\bsex(?:t|ting|ual)?\\b",
      "\\bhorny\\b",
      "\\b(?:dick|cock|pussy|boobs?|tits)\\b",
      "\\bvirgin(?:ity)?\\b"),
    new Group("self-harm", "alert",
      "a contact may be talking about self-harm or suicide — they might need help",
      "\\bkill\\s+(?:myself|me)\\b",
      "\\b(?:kms|kys)\\b",
      "\\bwant\\s+to\\s+die\\b",
      "\\b(?:suicide|suicidal)\\b",
      "\\b(?:cutting|cut)\\s+(?:myself|my\\s+(?:arms?|wrists?|legs?))\\b",
      "\\bself\\s*-?\\s*harm\\b",
      "\\bbetter\\s+off\\s+without\\s+me\\b",
      "\\bno\\s+reason\\s+to\\s+(?:live|be\\s+here|go\\s+on)\\b"),
    new Group("bullying", "watch",
      "targeted insults or exclusion — possible bullying",
      "\\bkill\\s+yourself\\b",
      "\\b(?:nobody|no\\s+one)\\s+(?:likes?|wants?)\\s+you\\b",
      "\\beveryone\\s+(?:hates?|laughs?\\s+at)\\s+you\\b",
      "\\byou'?re?\\s+(?:so\\s+)?(?:ugly|fat|worthless|pathetic|a\\s+loser|a\\s+freak)\\b",
      "\\byou\\s+(?:have|got)\\s+no\\s+friends\\b",
      "\\bwhy\\s+are\\s+you\\s+(?:even|still)\\s+(?:here|alive|at\\s+this\\s+school)\\b"),
    new Group("lure", "watch",
      "gift or reward offered by a contact — a common grooming opener",
      "\\bi(?:'ll|\\s+will)\\s+(?:buy|give|send|get)\\s+you\\s+(?:money|cash|a\\s+gift|gift\\s*cards?|robux|v-?bucks|skins?|nitro|credits?)\\b",
      "\\bfree\\s+(?:robux|v-?bucks|skins?|nitro|gift\\s*cards?|money)\\b",
      "\\bhow\\s+old\\s+are\\s+you\\b",
      "\\bwhat\\s+school\\s+do\\s+you\\s+(?:go|attend)\\b",
      "\\badd\\s+me\\s+on\\s+(?:snap(?:chat)?|telegram|whats\\s?app|discord|insta(?:gram)?|kik)\\b.{0,40}\\b(?:secret|private|don'?t\\s+tell)\\b"),
    new Group("scam", "watch",
      "classic scam pattern — fake prize, account threat, or payment demand",
      "\\byou(?:'ve|\\s+have)?\\s+won\\b",
      "\\bclaim\\s+your\\s+(?:prize|reward|gift)\\b",
      "\\bverify\\s+your\\s+account\\b",
      "\\bsend\\s+(?:your\\s+)?(?:password|otp|code|pin)\\b",
      "\\bclick\\s+(?:this|the)\\s+link\\b.{0,40}\\b(?:free|claim|win|prize)\\b",
      "\\baccount\\s+(?:will\\s+be\\s+)?(?:suspended|deleted|banned)\\b")
  );

  /** Normalize obfuscations: l33t, stretched letters, spacing. */
  static String normalize(String text) {
    return text
      .toLowerCase(Locale.ROOT)
      .replace('‘', '\'').replace('’', '\'')
      .replace('0', 'o').replace('1', 'i').replace('3', 'e').replace('$', 's')
      .replaceAll("(.)\\1{2,}", "$1")     // "parentsss" → "parents"
      .replaceAll("\\s+", " ");
  }

  /**
   * Scan one notification's text. First hit wins (alert groups listed before
   * watch groups). A hit on EITHER the raw or normalized form counts.
   */
  static Hit detect(String text) {
    if (text == null || text.isEmpty()) return null;
    String t = normalize(text);
    for (Group g : GROUPS) {
      for (Pattern p : g.patterns) {
        if (p.matcher(t).find() || p.matcher(text).find()) {
          return new Hit(g.category, g.severity, g.reason);
        }
      }
    }
    return null;
  }

  private Detection() {}
}
