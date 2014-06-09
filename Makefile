.PHONY: run setup phantomjs meteor

run: phantomjs meteor

setup:
	meteor-npm

phantomjs:
	cd server && phantomjs --webdriver=9134

meteor:
	meteor

clean:
	rm -rf packages .meteor/local
