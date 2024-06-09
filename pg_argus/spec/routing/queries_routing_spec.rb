require "rails_helper"

RSpec.describe QueriesController, type: :routing do
  describe "routing" do
    it "routes to #index" do
      expect(get: "/queries").to route_to("queries#index")
    end

    it "routes to #show" do
      expect(get: "/queries/1").to route_to("queries#show", id: "1")
    end


    it "routes to #create" do
      expect(post: "/queries").to route_to("queries#create")
    end

    it "routes to #update via PUT" do
      expect(put: "/queries/1").to route_to("queries#update", id: "1")
    end

    it "routes to #update via PATCH" do
      expect(patch: "/queries/1").to route_to("queries#update", id: "1")
    end

    it "routes to #destroy" do
      expect(delete: "/queries/1").to route_to("queries#destroy", id: "1")
    end
  end
end
