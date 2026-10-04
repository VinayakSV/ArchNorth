# String Problems — Anagrams, Palindromes, Parsing, and Compression

<!-- sdlc-stage:start -->
<div class="sdlc-stage">

📍 **SDLC stage: Design — architecture** · ShopNorth uses this in [Chapter 2 · System Design (HLD)](/tutorials/journey-02-system-design)

</div>
<!-- sdlc-stage:end -->

> String questions are the most common "warm-up" in backend interviews. They're rarely hard; they're easy to get *subtly* wrong. All code is Java.

---

## Table of Contents

1. The Scrabble Tiles Analogy
2. The Toolbox — Five Techniques That Solve 90% of String Problems
3. Frequency Counting — Anagrams & Grouping
4. Palindromes — Check, Expand, Longest
5. Reversal & Word Manipulation
6. Compression, Encoding & Parsing
7. Matching Brackets — Strings Meet Stacks
8. Java-Specific Performance Notes
9. Practice Assignments (Low / Medium / High)
10. Mini Project — Text Toolkit CLI
11. Interview Corner
12. Quick Reference

---

## 1. The Scrabble Tiles Analogy

Two words are **anagrams** if you could spell one with the other's Scrabble tiles. You don't compare the words letter-by-letter in order; you **count the tiles**: 1 L, 1 I, 1 S, 1 T, 1 E, 1 N for both "LISTEN" and "SILENT".

That idea — *turn the string into counts, then compare counts* — solves a huge family of problems. The other big ideas are:

- **Mirror reading** (palindromes): read from both ends toward the middle.
- **Build, don't concatenate**: use a `StringBuilder` so you don't copy the whole string on every change.
- **Scan once with state**: parsers, compressors, and validators walk left to right remembering just enough.

---

## 2. The Toolbox — Five Techniques

| Technique | When | Typical complexity |
|-----------|------|--------------------|
| **Frequency array / map** | Anagrams, "first unique", "can you form X from Y" | O(n) time, O(1) space for a fixed alphabet |
| **Two pointers** | Palindromes, reversal, compare with skips | O(n), O(1) |
| **Sliding window** | "Longest/shortest substring with property" | O(n) (see `dsa-sliding-window`) |
| **Stack** | Brackets, nested decoding, "remove adjacent duplicates" | O(n), O(n) |
| **Canonical key + HashMap** | Grouping (group anagrams, isomorphic strings) | O(n · k) |

<div class="callout-info">

**Always clarify the alphabet**: lowercase `a-z` only? ASCII? Full Unicode? It decides whether you use `int[26]`, `int[128]`, or a `HashMap<Integer, Integer>` over **code points**. Asking this question is itself a signal of experience.

</div>

---

## 3. Frequency Counting — Anagrams & Grouping

### Valid anagram (LeetCode 242)

```java
boolean isAnagram(String s, String t) {
    if (s.length() != t.length()) return false;
    int[] count = new int[26];
    for (int i = 0; i < s.length(); i++) {
        count[s.charAt(i) - 'a']++;
        count[t.charAt(i) - 'a']--;
    }
    for (int c : count) if (c != 0) return false;
    return true;
}
// O(n) time, O(1) space.  Sorting both strings works too, but is O(n log n).
```

Unicode version:

```java
boolean isAnagramUnicode(String s, String t) {
    Map<Integer, Integer> freq = new HashMap<>();
    s.codePoints().forEach(cp -> freq.merge(cp, 1, Integer::sum));
    t.codePoints().forEach(cp -> freq.merge(cp, -1, Integer::sum));
    return freq.values().stream().allMatch(v -> v == 0);
}
```

### Group anagrams (LeetCode 49) — canonical keys

```java
List<List<String>> groupAnagrams(String[] words) {
    Map<String, List<String>> groups = new HashMap<>();
    for (String w : words) {
        int[] count = new int[26];
        for (char c : w.toCharArray()) count[c - 'a']++;
        String key = Arrays.toString(count);                  // "[1, 0, 0, ...]" — canonical
        groups.computeIfAbsent(key, k -> new ArrayList<>()).add(w);
    }
    return new ArrayList<>(groups.values());
}
// ["eat","tea","tan","ate","nat","bat"] → [[eat,tea,ate],[tan,nat],[bat]]
```

| Key choice | Cost per word (length k) |
|-----------|--------------------------|
| Sorted chars `new String(sortedArr)` | O(k log k) |
| Count signature `Arrays.toString(count)` | O(k + 26) |

### First unique character (LeetCode 387)

```java
int firstUniqChar(String s) {
    int[] count = new int[26];
    for (char c : s.toCharArray()) count[c - 'a']++;
    for (int i = 0; i < s.length(); i++) if (count[s.charAt(i) - 'a'] == 1) return i;
    return -1;
}
```

Two passes: first count, then find. A classic pattern whenever the answer depends on the **whole** string's counts.

<div class="callout-tip">

**Applying this** — Canonical keys are how you deduplicate "equivalent" records in real systems: normalizing addresses (lowercase, strip punctuation, sort tokens) to group near-duplicate customer records, or building a fingerprint of a SQL query (literals replaced with `?`) to group slow queries in monitoring — `pg_stat_statements` does exactly this.

</div>

---

## 4. Palindromes — Check, Expand, Longest

### Check (two pointers)

See `dsa-two-pointers` §3 for the version that skips non-alphanumerics. Core idea: compare the ends, move inward.

### Valid Palindrome II — delete at most one character (LeetCode 680)

```java
boolean validPalindrome(String s) {
    int l = 0, r = s.length() - 1;
    while (l < r) {
        if (s.charAt(l) != s.charAt(r)) {
            return isPal(s, l + 1, r) || isPal(s, l, r - 1);   // try skipping either side once
        }
        l++; r--;
    }
    return true;
}
boolean isPal(String s, int l, int r) {
    while (l < r) if (s.charAt(l++) != s.charAt(r--)) return false;
    return true;
}
// "abca" → true (delete 'b' or 'c').  O(n).
```

### Longest palindromic substring (LeetCode 5) — expand around center

Every palindrome has a center: a character (odd length) or a gap between two characters (even length). There are `2n − 1` centers; expand from each.

```java
String longestPalindrome(String s) {
    int bestStart = 0, bestLen = 0;
    for (int center = 0; center < s.length(); center++) {
        int len1 = expand(s, center, center);          // odd:  "aba"
        int len2 = expand(s, center, center + 1);      // even: "abba"
        int len = Math.max(len1, len2);
        if (len > bestLen) {
            bestLen = len;
            bestStart = center - (len - 1) / 2;
        }
    }
    return s.substring(bestStart, bestStart + bestLen);
}
int expand(String s, int l, int r) {
    while (l >= 0 && r < s.length() && s.charAt(l) == s.charAt(r)) { l--; r++; }
    return r - l - 1;                                  // length of the palindrome found
}
// "babad" → "bab" (or "aba").  O(n²) time, O(1) space.
```

| Approach | Time | Space | Interview verdict |
|----------|------|-------|-------------------|
| Brute force: check all substrings | O(n³) | O(1) | Mention only as a baseline |
| DP table `dp[i][j]` | O(n²) | O(n²) | Fine, but uses memory |
| **Expand around center** | O(n²) | O(1) | ✅ Best to write under pressure |
| Manacher's algorithm | O(n) | O(n) | Mention that it exists; rarely expected |

<div class="callout-interview">

**Q: "Why do you expand from 2n − 1 centers?"**

Odd-length palindromes are centered on a character (n centers), and even-length ones on the gap between two adjacent characters (n − 1 centers). Missing the even case is the most common bug: "abba" would never be found.

</div>

---

## 5. Reversal & Word Manipulation

### Reverse words (LeetCode 151)

Library version (clear, O(n)):

```java
String reverseWords(String s) {
    String[] words = s.strip().split("\\s+");
    StringBuilder sb = new StringBuilder();
    for (int i = words.length - 1; i >= 0; i--) {
        sb.append(words[i]);
        if (i > 0) sb.append(' ');
    }
    return sb.toString();
}
```

In-place on a `char[]` (the follow-up for "O(1) extra space"): **reverse the whole array, then reverse each word**.

```text
"the sky is blue"
reverse all →   "eulb si yks eht"
reverse each →  "blue is sky the"
```

```java
void reverseWordsInPlace(char[] a) {          // assumes single spaces, no leading/trailing
    reverse(a, 0, a.length - 1);
    int start = 0;
    for (int i = 0; i <= a.length; i++) {
        if (i == a.length || a[i] == ' ') {
            reverse(a, start, i - 1);
            start = i + 1;
        }
    }
}
void reverse(char[] a, int l, int r) { while (l < r) { char t = a[l]; a[l++] = a[r]; a[r--] = t; } }
```

The same "reverse everything, then reverse the parts" trick **rotates an array by k** in O(1) space.

### Longest common prefix (LeetCode 14)

```java
String longestCommonPrefix(String[] strs) {
    if (strs.length == 0) return "";
    String prefix = strs[0];
    for (String s : strs) {
        while (!s.startsWith(prefix)) prefix = prefix.substring(0, prefix.length() - 1);
        if (prefix.isEmpty()) return "";
    }
    return prefix;
}
```

Alternative: sort the array, then compare only the **first and last** strings (they're the most different lexicographically).

---

## 6. Compression, Encoding & Parsing

### String compression — run-length encoding

```java
String compress(String s) {
    if (s.isEmpty()) return s;
    StringBuilder sb = new StringBuilder();
    int count = 1;
    for (int i = 1; i <= s.length(); i++) {
        if (i < s.length() && s.charAt(i) == s.charAt(i - 1)) {
            count++;
        } else {
            sb.append(s.charAt(i - 1)).append(count);
            count = 1;
        }
    }
    return sb.length() < s.length() ? sb.toString() : s;   // only if actually shorter
}
// "aabcccccaaa" → "a2b1c5a3";  "abc" → "abc"
```

The `i <= s.length()` bound flushes the last run — forgetting it is the classic bug.

### String to integer — `atoi` (LeetCode 8): the edge-case gauntlet

```java
int myAtoi(String s) {
    int i = 0, n = s.length(), sign = 1;
    long result = 0;
    while (i < n && s.charAt(i) == ' ') i++;                        // 1. leading spaces
    if (i < n && (s.charAt(i) == '+' || s.charAt(i) == '-')) {      // 2. optional sign
        sign = s.charAt(i) == '-' ? -1 : 1;
        i++;
    }
    while (i < n && Character.isDigit(s.charAt(i))) {               // 3. digits until non-digit
        result = result * 10 + (s.charAt(i) - '0');
        if (sign * result > Integer.MAX_VALUE) return Integer.MAX_VALUE;   // 4. clamp overflow
        if (sign * result < Integer.MIN_VALUE) return Integer.MIN_VALUE;
        i++;
    }
    return (int) (sign * result);
}
```

| Input | Output | Why |
|-------|--------|-----|
| `"   -42"` | -42 | spaces + sign |
| `"4193 with words"` | 4193 | stop at a non-digit |
| `"words 987"` | 0 | first non-space isn't a digit or sign |
| `"-91283472332"` | -2147483648 | clamp |
| `"+-12"` | 0 | only one sign allowed |

<div class="callout-scenario">

**Scenario**: A payments API parses amounts from partner CSV files with `Integer.parseInt(field.trim())`, and one partner starts sending `"1,499.00"` and `"₹1499"`. The batch crashes at 3 AM. **Decision**: This is `atoi` in real life — define the grammar explicitly (currency code in a separate column, a fixed decimal format), parse with `new BigDecimal(field)` inside a validation step, route bad rows to a dead-letter file with the reason, and never let one malformed field kill the batch. And never use `double` for money.

</div>

---

## 7. Matching Brackets — Strings Meet Stacks

### Valid parentheses (LeetCode 20)

```java
boolean isValid(String s) {
    Deque<Character> stack = new ArrayDeque<>();
    for (char c : s.toCharArray()) {
        switch (c) {
            case '(' -> stack.push(')');       // push the EXPECTED closer — simpler matching
            case '[' -> stack.push(']');
            case '{' -> stack.push('}');
            default -> { if (stack.isEmpty() || stack.pop() != c) return false; }
        }
    }
    return stack.isEmpty();
}
```

### Decode string (LeetCode 394): `"3[a2[c]]"` → `"accaccacc"`

```java
String decodeString(String s) {
    Deque<Integer> counts = new ArrayDeque<>();
    Deque<StringBuilder> builders = new ArrayDeque<>();
    StringBuilder cur = new StringBuilder();
    int k = 0;
    for (char c : s.toCharArray()) {
        if (Character.isDigit(c)) k = k * 10 + (c - '0');          // multi-digit counts: "12[a]"
        else if (c == '[') { counts.push(k); builders.push(cur); cur = new StringBuilder(); k = 0; }
        else if (c == ']') {
            String inner = cur.toString();
            cur = builders.pop();
            cur.append(inner.repeat(counts.pop()));
        } else cur.append(c);
    }
    return cur.toString();
}
```

<div class="callout-tip">

**Applying this** — The same stack-based parsing validates nested JSON/XML structure, evaluates template expressions (`${user.${field}}`), and matches `BEGIN`/`END` blocks in SQL migration scripts. When you see "nested" in a string problem, reach for a stack.

</div>

---

## 8. Java-Specific Performance Notes

| Trap | Fix |
|------|-----|
| `result += ch` in a loop → O(n²) copies | `StringBuilder` |
| `s.charAt(i)` in a hot loop over a huge string | Fine (O(1)); `toCharArray()` copies the string — use it only when you need to mutate |
| `s.substring(...)` in a loop | Each call allocates a copy (since Java 7u6) — pass indices instead of creating substrings |
| `s.split(...)` with a regex per call | Precompile a `Pattern`, or scan manually |
| `c - 'a'` on uppercase or non-letters | Negative index → `ArrayIndexOutOfBoundsException`; normalize or use a larger array |
| `str1 == str2` | Always `.equals()` (see `java-strings`) |
| `.length()` on emoji | UTF-16 units, not visible characters; use `codePoints()` when it matters |

---

## 9. 🏋️ Practice Assignments

### 🟢 Low — Build the reflexes

**L1.** Ransom note (LeetCode 383): can `ransomNote` be built from the letters of `magazine`, each letter used once?

<details>
<summary>Show answer</summary>

```java
boolean canConstruct(String note, String magazine) {
    int[] count = new int[26];
    for (char c : magazine.toCharArray()) count[c - 'a']++;
    for (char c : note.toCharArray()) if (--count[c - 'a'] < 0) return false;
    return true;
}
```

O(n + m), O(1) space.

</details>

**L2.** Reverse only the vowels of a string: `"hello"` → `"holle"`.

<details>
<summary>Show answer</summary>

```java
String reverseVowels(String s) {
    char[] a = s.toCharArray();
    int l = 0, r = a.length - 1;
    while (l < r) {
        while (l < r && "aeiouAEIOU".indexOf(a[l]) < 0) l++;
        while (l < r && "aeiouAEIOU".indexOf(a[r]) < 0) r--;
        char t = a[l]; a[l++] = a[r]; a[r--] = t;
    }
    return new String(a);
}
```

</details>

**L3.** Count the words in `"  Hello,   my name is  John "` without `split`.

<details>
<summary>Show answer</summary>

Count transitions from space to non-space:

```java
int countWords(String s) {
    int count = 0;
    for (int i = 0; i < s.length(); i++) {
        if (s.charAt(i) != ' ' && (i == 0 || s.charAt(i - 1) == ' ')) count++;
    }
    return count;
}
// → 5
```

</details>

### 🟡 Medium — Apply it

**M1.** Isomorphic strings (LeetCode 205): `"egg"`/`"add"` → true, `"foo"`/`"bar"` → false, `"badc"`/`"baba"` → false.

<details>
<summary>Show answer</summary>

The mapping must be one-to-one in **both** directions:

```java
boolean isIsomorphic(String s, String t) {
    int[] sToT = new int[256], tToS = new int[256];   // store (index + 1); 0 = unmapped
    for (int i = 0; i < s.length(); i++) {
        char a = s.charAt(i), b = t.charAt(i);
        if (sToT[a] != tToS[b]) return false;          // both must point to the same "last seen" position
        sToT[a] = i + 1;
        tToS[b] = i + 1;
    }
    return true;
}
```

`"badc"`/`"baba"` fails because `d` and `b` would both map to `b` — a one-directional map misses this.

</details>

**M2.** Longest palindrome you can **build** from a string's letters (LeetCode 409): `"abccccdd"` → 7.

<details>
<summary>Show answer</summary>

Use every pair; allow one odd character in the middle.

```java
int longestPalindromeBuild(String s) {
    int[] count = new int[128];
    for (char c : s.toCharArray()) count[c]++;
    int len = 0;
    boolean odd = false;
    for (int c : count) {
        len += c / 2 * 2;
        if (c % 2 == 1) odd = true;
    }
    return odd ? len + 1 : len;
}
```

</details>

**M3.** Remove all adjacent duplicates repeatedly (LeetCode 1047): `"abbaca"` → `"ca"`.

<details>
<summary>Show answer</summary>

Use a `StringBuilder` as a stack:

```java
String removeDuplicates(String s) {
    StringBuilder sb = new StringBuilder();
    for (char c : s.toCharArray()) {
        int n = sb.length();
        if (n > 0 && sb.charAt(n - 1) == c) sb.deleteCharAt(n - 1);
        else sb.append(c);
    }
    return sb.toString();
}
```

`"abbaca"`: a → ab → a (bb cancels) → "" (aa cancels) → c → ca. O(n).

</details>

### 🔴 High — Think like a senior

**H1.** Implement `String.indexOf(pattern)` in better than O(n·m) worst case, and explain when it matters in practice.

<details>
<summary>Show answer</summary>

**KMP**: precompute the LPS array (the longest proper prefix of the pattern that's also a suffix, for each prefix), so a mismatch never re-examines text characters.

```java
int indexOf(String text, String pat) {
    if (pat.isEmpty()) return 0;
    int[] lps = new int[pat.length()];
    for (int i = 1, len = 0; i < pat.length(); ) {
        if (pat.charAt(i) == pat.charAt(len)) lps[i++] = ++len;
        else if (len > 0) len = lps[len - 1];
        else lps[i++] = 0;
    }
    for (int i = 0, j = 0; i < text.length(); ) {
        if (text.charAt(i) == pat.charAt(j)) {
            i++; j++;
            if (j == pat.length()) return i - j;
        } else if (j > 0) j = lps[j - 1];
        else i++;
    }
    return -1;
}
```

O(n + m). In practice, the JDK's `indexOf` is a naive scan with SIMD intrinsics and wins for typical inputs. KMP-style guarantees matter with **adversarial input** (`"aaaa...ab"` in `"aaaa...a"`), which is a DoS vector when users control both strings. Related: Rabin-Karp (rolling hash) for multi-pattern search, and Aho-Corasick for thousands of keywords at once (e.g., content filters).

</details>

**H2.** A search service must suggest corrections for misspelled product names ("iphnoe" → "iphone") over a 2M-product catalog, under 50 ms. Sketch the approach.

<details>
<summary>Show answer</summary>

- **Distance metric**: Levenshtein edit distance (DP, O(m·n) per pair) — too slow against 2M names one by one.
- **Candidate generation**: an index of character **n-grams** (trigrams) — look up names sharing many trigrams with the query, then compute edit distance only on the top ~100 candidates. Or a **BK-tree** / **SymSpell** (precomputed deletions) for fast bounded-distance lookups.
- **Early exit**: bounded Levenshtein (stop when the distance exceeds 2), using only two DP rows (O(n) memory).
- **Ranking**: combine edit distance with popularity/click-through, keyboard-adjacency weights (n↔m), and transpositions (Damerau-Levenshtein handles "no"↔"on").
- **Production answer**: Elasticsearch/OpenSearch `fuzzy` queries (Levenshtein automata) or the phrase suggester, rather than hand-rolling it — but knowing the algorithms explains the tuning knobs (`fuzziness: AUTO`, `prefix_length`).

</details>

---

## 10. 🛠️ Mini Project — Text Toolkit CLI

**Goal**: A plain-Java command-line tool bundling the techniques above, with real inputs. 1-2 evenings.

**Commands**

```bash
java -jar texttool.jar anagrams words.txt          # group anagram families, largest first
java -jar texttool.jar palindromes book.txt        # longest palindromic substring per line
java -jar texttool.jar compress data.txt           # RLE compress + decompress + verify round-trip
java -jar texttool.jar validate config.tmpl        # bracket/brace balance with line:column of errors
java -jar texttool.jar suggest "iphnoe" products.txt   # top 5 by edit distance (bounded)
```

**Requirements**

1. Each command is a class implementing `Command` (strategy pattern), registered in a `Map<String, Command>`.
2. Stream files with `Files.lines` — don't load big files fully.
3. `validate` reports the **position** of the first mismatch (`line 12, col 7: expected '}' but found ']'`).
4. `compress` handles counts ≥ 10 (`a12`) and digits in the input — design an unambiguous format (e.g., escape digits) and document it.
5. `suggest` uses bounded Levenshtein with a two-row DP.

**Acceptance criteria**

- JUnit tests for each command, including empty input, Unicode input (`"नमन"` for palindromes), and huge counts.
- `anagrams` on a 300K-word dictionary finishes in under 2 seconds.
- A README listing each algorithm's time/space complexity.

**Stretch**: add a trigram index to `suggest` and compare latency against a full scan.

---

## 🎯 Interview Corner

<div class="callout-interview">

**Q: "Check if two strings are anagrams. What's the best approach, and what would you ask first?"**

I'd first ask about the character set — lowercase English, ASCII, or full Unicode — and whether case and spaces matter. For lowercase letters I use an `int[26]`: increment for one string, decrement for the other, and check all counts are zero. That's O(n) time and O(1) space, after an early length check. Sorting both strings works but is O(n log n). For Unicode I'd count code points in a HashMap, since a supplementary character is two Java chars, and I'd consider normalizing with `java.text.Normalizer` so "é" as one code point equals "e" plus a combining accent.

</div>

<div class="callout-interview">

**Q: "Find the longest palindromic substring."**

Brute force checks all O(n²) substrings at O(n) each, which is O(n³). The approach I'd write is expand-around-center: every palindrome is centered on a character or on a gap between two characters, so there are 2n − 1 centers. From each I expand outward while the ends match and track the longest. That's O(n²) time and O(1) space, and simple to get right. There's a DP table version with the same time but O(n²) space, and Manacher's algorithm achieves O(n), which I'd mention but not expect to write in an interview.

**Follow-up trap**: "Your code misses 'abba'." → That's the even-length case: I expand from `(i, i)` and from `(i, i+1)` for every i.

</div>

<div class="callout-interview">

**Q: "Implement string compression 'aabcccccaaa' → 'a2b1c5a3'. What edge cases matter?"**

A single scan with a run counter: when the next character differs, or I reach the end, I append the character and its count to a `StringBuilder` and reset. The edge cases are: flushing the final run, which is the usual bug; returning the original if the compressed form isn't shorter; empty input; multi-digit counts like `a12`; and — the one people miss — inputs that already contain digits, which make the format ambiguous to decode, so a real format needs escaping or length prefixes. It's O(n) time and O(n) for the output. In practice I'd use a real codec (gzip, zstd, Snappy) rather than invent one.

</div>

---

## Quick Reference

| Problem family | Technique | Complexity |
|----------------|-----------|------------|
| Anagram / ransom note / permutation check | `int[26]` counts | O(n), O(1) |
| Group anagrams | Canonical key → HashMap | O(n·k) |
| First unique char | Count, then scan | O(n) |
| Palindrome check (with skips / 1 delete) | Two pointers | O(n) |
| Longest palindromic substring | Expand around 2n−1 centers | O(n²), O(1) |
| Reverse words in place | Reverse all, then each word | O(n), O(1) |
| RLE compression | Run counter + StringBuilder | O(n) |
| atoi / parsing | State machine + overflow clamp | O(n) |
| Brackets, nested decode | Stack | O(n) |
| Substring search | JDK `indexOf`; KMP for guarantees | O(n+m) |
| Fuzzy match | Levenshtein DP + candidate index | O(m·n) per pair |

---

## Related Topics

- `java-strings` — immutability, StringBuilder, and the String pool
- `dsa-two-pointers` — palindrome and reversal mechanics
- `dsa-sliding-window` — substring windows with frequency maps

> **Most string problems are counting problems or pointer problems in disguise. Ask about the alphabet, then pick the counter or the pointers — the rest is edge cases.**

---

<!-- journey-link:start -->

<div class="callout-journey">

🛒 **ShopNorth Journey** — Normalizing and prefix-matching search text underpins ShopNorth's search suggestions.

**Continue the story:** [Chapter 2 · System Design (HLD)](/tutorials/journey-02-system-design) · **New here?** [Start the journey](/tutorials/journey-start)

</div>

<!-- journey-link:end -->
