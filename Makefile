.PHONY: run setup phantomjs meteor

run: setup xvs wds meteor

setup:
	@meteor-npm

wds: wd1 wd2 wd3 wd4 wd5
wd1:
	@DISPLAY=:1.0 java -jar jars/selenium-server-standalone-2.42.2.jar -port 9135
wd2:
	@DISPLAY=:2.0 java -jar jars/selenium-server-standalone-2.42.2.jar -port 9136
wd3:
	@DISPLAY=:3.0 java -jar jars/selenium-server-standalone-2.42.2.jar -port 9137
wd4:
	@DISPLAY=:4.0 java -jar jars/selenium-server-standalone-2.42.2.jar -port 9138
wd5:
	@DISPLAY=:5.0 java -jar jars/selenium-server-standalone-2.42.2.jar -port 9139

xvs: xv1 xv2 xv3 xv4 xv5
xv1:
	@Xvfb :1 -screen 0 1024x768x8
xv2:
	@Xvfb :2 -screen 0 1024x768x8
xv3:
	@Xvfb :3 -screen 0 1024x768x8
xv4:
	@Xvfb :4 -screen 0 1024x768x8
xv5:
	@Xvfb :5 -screen 0 1024x768x8

meteor:
	@echo "Starting meteor..."
	@meteor

clean:
	@rm -rf .meteor/local
