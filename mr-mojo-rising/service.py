#! /usr/bin/python

import subprocess
import sys
import time

def main():
  server = sys.stdin.readline()
  server_len = 0
  while server_len < 128 and (server[server_len] == '.' or server[server_len] == ':' or server[server_len].isalnum()):
    server_len += 1
  server = server[:server_len]

  args = [
    '/home/user/chrome/chrome',
    '--disable-gpu',
    '--headless', '--timeout=15000', '--dump-dom',
    'https://' + server,
  ]

  p = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

  time.sleep(0.1)

  with open('/proc/{}/maps'.format(p.pid), 'r') as tmp:
    map = tmp.read().rstrip('\n')

  out, err = p.communicate()

  print '-- map ---------------------------------------------------------------'
  print map
  print '----------------------------------------------------------------------'

  print '-- out ---------------------------------------------------------------'
  print out
  print '----------------------------------------------------------------------'

  print '-- err ---------------------------------------------------------------'
  print err
  print '----------------------------------------------------------------------'

if __name__ == '__main__':
  main()
