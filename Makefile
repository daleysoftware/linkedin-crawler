.PHONY: run setup phantomjs meteor

run: setup dockers meteor

setup:
	@meteor-npm

# FIXME once https://github.com/ariya/phantomjs/issues/11596 is resolved, don't use docker.
dockers:
	@for i in $$(seq 1 5); do make docker; done

docker:
	@sudo docker run -d cmfatih/phantomjs /usr/bin/phantomjs --webdriver=9135 >> .docker-cids
	@sudo docker inspect --format '{{ .NetworkSettings.IPAddress }}' $$(cat .docker-cids | tail -1) >> .docker-ips
	@echo "Docker container IP $$(cat .docker-ips | tail -1)"

meteor:
	@echo "Starting meteor..."
	@meteor

clean:
	@./clean.sh
