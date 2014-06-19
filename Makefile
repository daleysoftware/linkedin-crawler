.PHONY: run setup phantomjs meteor

run: setup dockers meteor

setup:
	@meteor-npm

# FIXME once https://github.com/ariya/phantomjs/issues/11596 is resolved, don't use docker.
dockers:
	@for i in $$(seq 1 5); do make docker; done
	@make ips

docker:
	@sudo docker run -d cmfatih/phantomjs /usr/bin/phantomjs --webdriver=9135 >> .docker-cids

ips:
	@sudo echo $$(cat .docker-cids) | xargs docker inspect --format '{{ .NetworkSettings.IPAddress }}' > .docker-ips

meteor:
	@echo "Starting meteor..."
	@meteor

clean:
	@./clean.sh
