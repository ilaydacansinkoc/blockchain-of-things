import socket


s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
host = '192.168.137.118'# ip of raspberry pi
port = 12345
s.connect((host, port))
while 1:
    file = open("data.txt","a+")
    file.write(s.recv(1024).decode()+"\n")
    file.close()


