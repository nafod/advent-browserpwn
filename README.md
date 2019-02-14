Advent 2018 - Browser Pwning
---

This is my advent calendar for 2018 which is all about browser pwning. You can view the
calendar directly on the adventar website: https://adventar.org/calendars/3435,
and read me blog post about it [here](https://nafod.net/blog/2019/02/13/advent-browserpwn-2018.html)

Everything was developed and targeted to my local system, which is:
```
vagrant@ubuntu-artful:~$ uname -a
Linux ubuntu-artful 4.13.0-46-generic #51-Ubuntu SMP Tue Jun 12 12:36:29 UTC 2018 x86_64 x86_64 x86_64 GNU/Linux
vagrant@ubuntu-artful:~$ lsb_release -a
No LSB modules are available.
Distributor ID: Ubuntu
Description:    Ubuntu 17.10
Release:        17.10
Codename:       artful
```

Below is the current status of my challenges:

12/01   cmalekpour  
blazefox 2018 (SOLVED)

12/03   cmalekpour  
csaw 2018 chrome challenge (SOLVED)

12/05   cmalekpour  
learning v8 (reading)

12/07   cmalekpour  
plaidctf 2018 roll a d8 (SOLVED)

12/10   cmalekpour  
34c3 ctf v9 challenge (SOLVED)

note: for this challenge I used saelo's `v9_7.0.patch` patchfile, targetting v8 7.0.276.28
I believe the challenge was originally run with v8 version 6.3.292.48. however, I figured
the later version would be more relevant.

???
35c3 krautflare (SOLVED)

took some time from the rest of my schedule to work on this one, ended up solving it a few days
after the competition ended. s/o to others online for letting me know about webassembly rwx jit
buffers.

12/14   cmalekpour  
awesome-browser-exploit (reading)

12/17   cmalekpour  
googlectf finals 2018 just in time (SOLVED)

note: for this challenge I targeted the following commit, to which the patch applied
cleanly. I didn't verify that this is what the challenge used, but it looks likely to me.
Also, I didn't target full chrome since I was too lazy to build it. Therefore, I passed
`--no-unsafe-code-mitigations` to v8 to emulate the behavior chrome would have with process
isolation enabled (which turns that 'protection' off in v8).
```
commit 6bfe386658b720ddb44e7723e056bd7f11ce2fab (tag: 7.0.276.26)
Author: V8 Autoroll <v8-ci-autoroll-builder@chops-service-accounts.iam.gserviceaccount.com>
Date:   Mon Oct 8 06:50:39 2018 -0700

    Version 7.0.276.26
```

12/24   cmalekpour  
googlectf 2018 finals mr mojo rising (SOLVED)
You can see a little asciinema of it landing here: https://asciinema.org/a/7SqpxsaqlwqvMmydvBOkSI6Mp

useful gdb stuff
---

```
set detach-on-fork off
set schedule-multiple on
set follow-fork-mode parent
set non-stop on
set target-async on
set print symbol-loading off
```
