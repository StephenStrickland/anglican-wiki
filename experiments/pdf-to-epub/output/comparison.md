# Conversion Experiment Results
Generated: 2026-02-19 20:36
Source PDF: `public/assets/1662/1662-daily-office-lectionary-ivp.pdf`

## Quick Comparison

Below are the first 30 lines of Markdown output from each approach.
Open the full files or EPUBs for detailed review.

### A_pdfplumber

```
# Daily Office Lectionary (1662 BCP)


## Page 1

Proper Lessons
to be read at Morning and Evening
Prayer on the Sundays and other
holy days throughout the year.
Lessons Proper for Sundays.
Mattins Evensong
Sundays 1 Lesson 2 Lesson 1 Lesson 2 Lesson
Of Advent
1 Isa. 1 - Isa. 2 -
2 5 - 24 -
3 25 - 26 -
4 30 - 32 -
After Christmas
1 37 - 38 -
2 41 - 43 -
After Epiphany
1 44 - 46 -
2 51 - 53 -
3 55 - 56 -
4 57 - 58 -
5 59 - 64 -
6 65 - 66 -
Septuagesima Gen. 1 - Gen. 2 -
Sexagesima 3 - 6 -
Quinquagesima 9:1-19 - 12 -
```

### B_pdfminer

```
# Daily Office Lectionary (1662 BCP)

```
Proper Lessons
to be read at Morning and Evening 
Prayer on the Sundays and other 
holy days throughout the year.

Lessons Proper for Sundays.

Mattins

Evensong

1 Lesson

2 Lesson

1 Lesson

2 Lesson

Sundays

Of Advent

1
2
3
4
```

### C_pypdfium2

```
# Daily Office Lectionary (1662 BCP)

## Page 1

Proper Lessons
to be read at Morning and Evening
Prayer on the Sundays and other
holy days throughout the year.
Lessons Proper for Sundays.
Sundays
Mattins Evensong
1 Lesson 2 Lesson 1 Lesson 2 Lesson
Of Advent
1 Isa. 1 - Isa. 2 -
2 5 - 24 -
3 25 - 26 -
4 30 - 32 -
After Christmas
1 37 - 38 -
2 41 - 43 -
After Epiphany
1 44 - 46 -
2 51 - 53 -
3 55 - 56 -
4 57 - 58 -
5 59 - 64 -
6 65 - 66 -
Septuagesima Gen. 1 - Gen. 2 -
Sexagesima 3 - 6 -
Quinquagesima 9:1-19 - 12 -
```

### D_pdftotext

```
# Daily Office Lectionary (1662 BCP)

## Layout-Preserved Extraction

```
                  Proper Lessons
           to be read at Morning and Evening
            Prayer on the Sundays and other
              holy days throughout the year.

               Lessons Proper for Sundays.
                        Mattins               Evensong
Sundays         1 Lesson     2 Lesson   1 Lesson   2 Lesson
Of Advent
  1               Isa. 1         -       Isa. 2       -
  2                 5            -         24         -
  3                25            -         26         -
  4                30            -         32         -
After Christmas
  1                 37           -        38          -
  2                41            -        43          -
After Epiphany
  1                44            -       46           -
  2                 51           -       53           -
  3                55            -       56           -
  4                57            -       58           -
  5                59            -       64           -
  6                65            -       66           -
Septuagesima     Gen. 1          -      Gen. 2        -
Sexagesima          3            -        6           -
```

### E_pandoc_direct

```
# Daily Office Lectionary (1662 BCP)

Proper Lessons
to be read at Morning and Evening
Prayer on the Sundays and other
holy days throughout the year.
Lessons Proper for Sundays.

Mattins
Sundays
1 Lesson
2 Lesson
Of Advent
1
Isa. 1
2
5
3
25
4
30
After Christmas
1
37
2
41
After Epiphany
1
44
2
```

### F_pdfminer_html

```
# Daily Office Lectionary (1662 BCP)

50.0Page 1

Proper Lessons
  
to be read at Morning and Evening
  
Prayer on the Sundays and other
  
holy days throughout the year.

Lessons Proper for Sundays.

Mattins

Evensong

1 Lesson

2 Lesson

1 Lesson

2 Lesson

Sundays

Of Advent

```

### G_pymupdf

```
# Daily Office Lectionary (1662 BCP)

## Page 1

Proper Lessons
to be read at Morning and Evening 
Prayer on the Sundays and other 
holy days throughout the year.
Lessons Proper for Sundays.
Sundays
Mattins
Evensong
1 Lesson
2 Lesson
1 Lesson
2 Lesson
Of Advent
1
Isa. 1
-
Isa. 2
-
2
5
-
24
-
3
25
-
```

## Output File Sizes

| Approach | Markdown | EPUB |
|----------|----------|------|
| A_pdfplumber | 18.4 KB | 11.9 KB |
| B_pdfminer | 18.4 KB | 9.7 KB |
| C_pypdfium2 | 19.4 KB | 12.0 KB |
| D_pdftotext | 69.7 KB | 10.6 KB |
| E_pandoc_direct | 18.0 KB | 10.6 KB |
| F_pdfminer_html | 26.8 KB | 15.1 KB |
| G_pymupdf | 18.5 KB | 12.0 KB |
